"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeSheet, manpowerCost, travelCost } from "@/lib/costing";
import { savePrice, saveSheet } from "../../masterActions";

const inr = (n) => (n === null || n === undefined || Number.isNaN(n) ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`);
const lakh = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : inr(n));

// The price step: type the quote directly, or work it out — BOQ, manpower with statutory costs, travel and stay,
// other costs, overheads, contingency, margin and GST — and use the suggested quote.
export default function CostPlanner({ matchId, initial, estimate, saved, fresh, onDone }) {
  const [mode, setMode] = useState(saved?.price ? "done" : fresh ? "choose" : "plan");
  const [s, setS] = useState(initial);
  const [direct, setDirect] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = useMemo(() => computeSheet(s), [s]);
  const timer = useRef(null);

  // autosave the sheet while planning
  useEffect(() => {
    if (mode !== "plan") return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => saveSheet({ matchId, sheet: s }), 1500);
    return () => clearTimeout(timer.current);
  }, [s, mode, matchId]);

  const set = (k, v) => setS((x) => ({ ...x, [k]: v }));
  const setRow = (sec, i, k, v) => setS((x) => ({ ...x, [sec]: x[sec].map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const addRow = (sec, row) => setS((x) => ({ ...x, [sec]: [...x[sec], row] }));
  const delRow = (sec, i) => setS((x) => ({ ...x, [sec]: x[sec].filter((_, j) => j !== i) }));

  async function finish(args, label) {
    setBusy(true); setErr("");
    const r = await savePrice({ matchId, ...args });
    setBusy(false);
    if (r.error) return setErr(r.error);
    onDone?.(label);
  }

  if (mode === "choose") {
    return (
      <div className="row" style={{ gap: 8 }}>
        <button onClick={() => setMode("direct")}>I know my price</button>
        <button className="ghost" onClick={() => setMode("plan")}>Work out the cost with me</button>
      </div>
    );
  }
  if (mode === "direct") {
    return (
      <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); finish({ price: direct, note }, `My price: ${inr(Number(direct))} + GST`); }}>
        <div className="form-grid">
          <div><label htmlFor="pr">Price you will quote (₹, before GST)</label><input id="pr" inputMode="numeric" value={direct} onChange={(e) => setDirect(e.target.value.replace(/[^\d.]/g, ""))} autoFocus placeholder="e.g. 540000" /></div>
          <div><label htmlFor="pn">Note (optional)</label><input id="pn" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 12% below estimate" /></div>
        </div>
        {estimate && Number(direct) > 0 && <div className="tiny faint">{Math.abs(((Number(direct) - estimate) / estimate) * 100).toFixed(1)}% {Number(direct) < estimate ? "below" : "above"} the estimate of {lakh(estimate)}</div>}
        {err && <div className="small" style={{ color: "var(--blood)" }}>{err}</div>}
        <div className="row" style={{ gap: 8 }}><button disabled={busy || !Number(direct)}>Save my price</button><button type="button" className="ghost" onClick={() => setMode("plan")}>Work it out instead</button></div>
      </form>
    );
  }
  if (mode === "done") {
    return <div className="row" style={{ gap: 8 }}><span className="small">Price saved: <strong>{inr(saved.price)}</strong> + GST</span><button className="ghost sm" onClick={() => setMode("plan")}>Open the cost planner</button></div>;
  }

  return (
    <div className="stack-sm" style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.7fr) minmax(240px, 1fr)", gap: 12, alignItems: "start" }}>
        <div className="stack-sm">
          <Section title="Items / BOQ" total={c.boq} onAdd={() => addRow("boq", { item: "", unit: "job", qty: "", rate: "" })}>
            <table className="small" style={{ width: "100%" }}><thead><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Rate ₹</th><th className="right">Amount</th><th /></tr></thead><tbody>
              {s.boq.map((r, i) => <tr key={i}><td><input value={r.item} onChange={(e) => setRow("boq", i, "item", e.target.value)} style={cell} /></td><td><input value={r.unit} onChange={(e) => setRow("boq", i, "unit", e.target.value)} style={{ ...cell, maxWidth: 60 }} /></td><td><Num v={r.qty} on={(v) => setRow("boq", i, "qty", v)} w={60} /></td><td><Num v={r.rate} on={(v) => setRow("boq", i, "rate", v)} /></td><td className="right num">{inr(Number(r.qty) * Number(r.rate))}</td><td><X on={() => delRow("boq", i)} /></td></tr>)}
            </tbody></table>
          </Section>
          <Section title={`Manpower (${s.months} months; PF ${s.statutory.pf_pct}%, ESI ${s.statutory.esi_pct}% up to ₹${s.statutory.esi_wage_limit}, bonus ${s.statutory.bonus_pct}%)`} total={c.manpower} onAdd={() => addRow("manpower", { role: "", count: 1, months: "", monthly_wage: "" })}>
            <table className="small" style={{ width: "100%" }}><thead><tr><th>Role</th><th>People</th><th>Months</th><th>Wage ₹/month</th><th className="right">Cost to you</th><th /></tr></thead><tbody>
              {s.manpower.map((r, i) => { const mc = manpowerCost(r, s.statutory, s.months); return <tr key={i}><td><input value={r.role} onChange={(e) => setRow("manpower", i, "role", e.target.value)} style={cell} placeholder="e.g. Audit assistant" /></td><td><Num v={r.count} on={(v) => setRow("manpower", i, "count", v)} w={50} /></td><td><Num v={r.months} on={(v) => setRow("manpower", i, "months", v)} w={50} /></td><td><Num v={r.monthly_wage} on={(v) => setRow("manpower", i, "monthly_wage", v)} /></td><td className="right num" title={`${inr(mc.perMonth)} per person per month`}>{inr(mc.total)}</td><td><X on={() => delRow("manpower", i)} /></td></tr>; })}
            </tbody></table>
          </Section>
          <Section title="Travel and stay" total={c.travel} onAdd={() => addRow("travel", { purpose: "", trips: "", persons: 1, fare: "", days: 1, per_diem: 1000, stay: 2500 })}>
            <table className="small" style={{ width: "100%" }}><thead><tr><th>Purpose</th><th>Trips</th><th>People</th><th>Fare ₹</th><th>Days</th><th>Per diem ₹</th><th>Stay ₹/night</th><th className="right">Amount</th><th /></tr></thead><tbody>
              {s.travel.map((r, i) => <tr key={i}><td><input value={r.purpose} onChange={(e) => setRow("travel", i, "purpose", e.target.value)} style={cell} /></td>{["trips", "persons", "fare", "days", "per_diem", "stay"].map((k) => <td key={k}><Num v={r[k]} on={(v) => setRow("travel", i, k, v)} w={k === "fare" || k === "stay" ? 70 : 45} /></td>)}<td className="right num">{inr(travelCost(r))}</td><td><X on={() => delRow("travel", i)} /></td></tr>)}
            </tbody></table>
          </Section>
          <Section title="Other costs (materials, equipment, software, EMD/BG charges…)" total={c.other} onAdd={() => addRow("other", { item: "", amount: "" })}>
            {s.other.map((r, i) => <div key={i} className="row" style={{ gap: 6, flexWrap: "nowrap", marginBottom: 4 }}><input value={r.item} onChange={(e) => setRow("other", i, "item", e.target.value)} style={cell} placeholder="What" /><Num v={r.amount} on={(v) => setRow("other", i, "amount", v)} w={120} /><X on={() => delRow("other", i)} /></div>)}
          </Section>
          <details className="small"><summary>Assumptions (period, statutory rates)</summary>
            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              <label>Months <Num v={s.months} on={(v) => set("months", v)} w={50} /></label>
              {[["pf_pct", "PF %"], ["esi_pct", "ESI %"], ["esi_wage_limit", "ESI wage limit ₹"], ["bonus_pct", "Bonus %"], ["leave_pct", "Leave/relief %"]].map(([k, l]) => <label key={k}>{l} <Num v={s.statutory[k]} on={(v) => set("statutory", { ...s.statutory, [k]: v })} w={70} /></label>)}
            </div>
          </details>
        </div>

        <aside className="stack-sm" style={{ position: "sticky", top: 12, border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "var(--paper, #fff)" }}>
          <strong>Your cost</strong>
          {[["Items / BOQ", c.boq], ["Manpower", c.manpower], ["Travel and stay", c.travel], ["Other", c.other]].map(([l, v]) => (
            <div key={l}>
              <div className="row between tiny"><span>{l}</span><span>{inr(v)}</span></div>
              <div style={{ height: 5, background: "var(--line-soft)", borderRadius: 9 }}><div style={{ width: `${c.direct ? (v / c.direct) * 100 : 0}%`, height: "100%", background: "var(--madder)", borderRadius: 9 }} /></div>
            </div>
          ))}
          <div className="row between small"><span>Direct cost</span><strong>{inr(c.direct)}</strong></div>
          {[["overhead_pct", "Overheads", c.overhead], ["contingency_pct", "Contingency", c.contingency]].map(([k, l, v]) => <div key={k} className="row between small"><span>{l} <Num v={s[k]} on={(x) => set(k, x)} w={44} />%</span><span>{inr(v)}</span></div>)}
          <div className="row between small"><span>Total cost</span><strong>{inr(c.cost)}</strong></div>
          <div className="small">Margin <strong>{s.margin_pct}%</strong>
            <input type="range" min="0" max="40" step="0.5" value={s.margin_pct} onChange={(e) => set("margin_pct", e.target.value)} style={{ width: "100%" }} aria-label="Margin %" />
          </div>
          <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
            <div className="kpi-label">Suggested quote (before GST)</div>
            <div className="kpi" style={{ fontSize: 24 }}>{inr(c.quote)}</div>
            <div className="tiny faint">GST {s.gst_pct}%: {inr(c.gst)} · with GST {inr(c.withGst)}{s.months ? ` · ${inr(c.quote / s.months)} a month` : ""}</div>
            {c.vsEstimatePct !== null && <div className={`chip ${c.vsEstimatePct <= 0 ? "ok" : "warn"}`} style={{ marginTop: 6 }}>{Math.abs(c.vsEstimatePct)}% {c.vsEstimatePct <= 0 ? "below" : "above"} the estimate ({lakh(s.estimate)})</div>}
          </div>
          {err && <div className="small" style={{ color: "var(--blood)" }}>{err}</div>}
          <button disabled={busy || !c.quote} onClick={() => finish({ sheet: s }, `Use the planner's quote: ${inr(c.quote)} + GST`)}>Use {inr(c.quote)} as my price</button>
          <button className="ghost sm" onClick={() => setMode("direct")}>Type a different price</button>
        </aside>
      </div>
    </div>
  );
}

// Kept outside the planner so inputs keep their focus while typing.
const cell = { padding: "4px 6px", width: "100%", minWidth: 60 };
function Section({ title, total, children, onAdd }) {
  return (
    <section style={{ border: "1px solid var(--line-soft)", borderRadius: 10, padding: 10, overflowX: "auto" }}>
      <div className="row between" style={{ marginBottom: 6 }}><strong className="small">{title}</strong><span className="small">{inr(total)}</span></div>
      {children}
      <button type="button" className="ghost sm" style={{ marginTop: 6 }} onClick={onAdd}>+ Add a line</button>
    </section>
  );
}
const Num = ({ v, on, w = 90 }) => <input inputMode="decimal" value={v ?? ""} onChange={(e) => on(e.target.value.replace(/[^\d.]/g, ""))} style={{ ...cell, maxWidth: w }} />;
const X = ({ on }) => <button type="button" className="ghost sm" onClick={on} aria-label="Remove line" style={{ padding: "2px 8px" }}>×</button>;
