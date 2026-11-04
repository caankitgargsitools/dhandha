"use client";
import { useState } from "react";

// focus the first box without scrolling the page (autoFocus would jump the window)
const focusOnce = (el) => { if (el && !el.dataset.f) { el.dataset.f = "1"; el.focus({ preventScroll: true }); } };

// Answer widgets for the assistant's master questions. Each calls `send(myText, action)`; the assistant shows
// the answer as the person's bubble, saves it to the masters and moves to the next question.

export function MasterAnswer({ step, busy, send, skip }) {
  const [v, setV] = useState("");
  const submit = (e) => { e.preventDefault(); send(step.options ? step.options[v] : v, v); };
  if (step.options) {
    return (
      <div className="row" style={{ gap: 6 }}>
        {Object.entries(step.options).map(([k, l]) => <button key={k} className="sm ghost" disabled={busy} onClick={() => send(l, k)}>{l}</button>)}
        <button className="sm ghost" disabled={busy} onClick={skip}>Skip</button>
      </div>
    );
  }
  const money = step.type === "money";
  return (
    <form className="row" style={{ gap: 8, flexWrap: "nowrap" }} onSubmit={submit}>
      {step.long ? <textarea value={v} onChange={(e) => setV(e.target.value)} rows={2} ref={focusOnce} style={{ flex: 1 }} aria-label={step.label} />
        : <input value={v} onChange={(e) => setV(money ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)} ref={focusOnce} aria-label={step.label} placeholder={step.hint || (money ? "Amount in rupees" : "")}
          type={step.type === "date" ? "date" : step.type === "email" ? "email" : "text"} inputMode={money || step.type === "tel" ? "numeric" : undefined} style={{ flex: 1, width: "auto" }} />}
      {money && Number(v) > 0 && <span className="tiny faint" style={{ alignSelf: "center", whiteSpace: "nowrap" }}>₹{Number(v).toLocaleString("en-IN")}</span>}
      <button disabled={busy || !String(v).trim()}>Send</button>
      <button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button>
    </form>
  );
}

// One completed work (name, client, value, completion date): a single record, not a table.
export function WorkAnswer({ busy, send, skip }) {
  const [w, setW] = useState({ work_name: "", client: "", value_inr: "", start_date: "", end_date: "", work_order_no: "", scope: "" });
  const f = (k) => (e) => setW({ ...w, [k]: k === "value_inr" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value });
  return (
    <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); send(`${w.work_name} for ${w.client}, ₹${Number(w.value_inr || 0).toLocaleString("en-IN")}${w.end_date ? `, completed ${w.end_date}` : ""}`, w); }}>
      <div className="form-grid">
        <div><label htmlFor="wn">What was the work?</label><input id="wn" value={w.work_name} onChange={f("work_name")} ref={focusOnce} /></div>
        <div><label htmlFor="wc">For which client?</label><input id="wc" value={w.client} onChange={f("client")} /></div>
        <div><label htmlFor="wv">Contract value (₹)</label><input id="wv" inputMode="numeric" value={w.value_inr} onChange={f("value_inr")} /></div>
        <div><label htmlFor="ws">Started on</label><input id="ws" type="date" value={w.start_date} onChange={f("start_date")} /></div>
        <div><label htmlFor="we">Completed on</label><input id="we" type="date" value={w.end_date} onChange={f("end_date")} /></div>
        <div><label htmlFor="wo">Work order no. (optional)</label><input id="wo" value={w.work_order_no} onChange={f("work_order_no")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label htmlFor="wsc">Scope in one line (optional)</label><input id="wsc" value={w.scope} onChange={f("scope")} placeholder="e.g. Statutory audit of 12 branches" /></div>
      </div>
      <div className="tiny faint">Saved once in Vault → Experience; every later format fills these from there.</div>
      <div className="row" style={{ gap: 8 }}><button disabled={busy || !w.work_name || !w.client || !w.value_inr}>Save this work</button><button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button></div>
    </form>
  );
}

export function PersonAnswer({ busy, send, skip }) {
  const [p, setP] = useState({ name: "", designation: "", qualification: "", years: "", membership_no: "", pan: "" });
  const f = (k) => (e) => setP({ ...p, [k]: e.target.value });
  return (
    <form className="stack-sm" onSubmit={(e) => { e.preventDefault(); send(`${p.name}${p.designation ? `, ${p.designation}` : ""}${p.qualification ? ` (${p.qualification})` : ""}${p.years ? `, ${p.years} years` : ""}`, p); }}>
      <div className="form-grid">
        <div><label htmlFor="pnm">Name</label><input id="pnm" value={p.name} onChange={f("name")} ref={focusOnce} /></div>
        <div><label htmlFor="pds">Designation</label><input id="pds" value={p.designation} onChange={f("designation")} /></div>
        <div><label htmlFor="pq">Qualification</label><input id="pq" value={p.qualification} onChange={f("qualification")} placeholder="e.g. FCA, B.E. Civil" /></div>
        <div><label htmlFor="py">Years of experience</label><input id="py" inputMode="numeric" value={p.years} onChange={f("years")} /></div>
        <div><label htmlFor="pm">Membership no. (ICAI etc.)</label><input id="pm" value={p.membership_no} onChange={f("membership_no")} /></div>
        <div><label htmlFor="pp">PAN</label><input id="pp" value={p.pan} onChange={f("pan")} placeholder="ABCDE1234F" /></div>
      </div>
      <div className="row" style={{ gap: 8 }}><button disabled={busy || !p.name}>Save this person</button><button type="button" className="ghost" disabled={busy} onClick={skip}>Skip</button></div>
    </form>
  );
}

// The format picker: each of the tender's formats with the best choice pre-selected and the alternatives —
// several standard versions where the tender only names the format, versions other tenders use (the learned
// catalogue, filtered by industry), each with a preview; and formats the tender did not list can be added from the catalogue.
export function FormatPicker({ step, busy, send }) {
  const [rows, setRows] = useState(step.formats);
  const [pick, setPick] = useState(() => Object.fromEntries(step.formats.map((f) => [f.title, f.options[0].kind])));
  const [open, setOpen] = useState(null);
  const [sector, setSector] = useState(step.sector || "all");
  const [q, setQ] = useState("");
  const list = rows.map((f) => ({ title: f.title, page: f.page, kind: pick[f.title] }));
  const ai = list.filter((x) => x.kind === "custom").length;
  const free = list.filter((x) => /^(tpl|cat):/.test(String(x.kind))).length;
  const fits = (o) => !String(o.kind).startsWith("cat:") || sector === "all" || (o.sectors || []).includes(sector);
  const have = new Set(rows.flatMap((f) => f.options.map((o) => o.kind)));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const more = (step.catalog || []).filter((e) => !have.has(`cat:${e.id}`) && (sector === "all" || (e.sectors || []).includes(sector)) && words.every((w) => e.heading.toLowerCase().includes(w))).slice(0, 12);
  const add = (e) => {
    let title = e.heading;
    while (rows.some((r) => r.title === title)) title = `${title} (2)`;
    const opt = { kind: `cat:${e.id}`, label: `${e.heading} — used in ${e.seen_count} tender${e.seen_count === 1 ? "" : "s"} (free)`, sectors: e.sectors || [] };
    setRows([...rows, { title, page: null, added: true, options: [opt, { kind: "manual", label: "I'll fill this one myself" }] }]);
    setPick({ ...pick, [title]: opt.kind });
  };
  return (
    <div className="stack-sm">
      {step.sectors?.length ? (
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <label htmlFor="fp-sector" className="small faint">Formats other tenders use, from</label>
          <select id="fp-sector" value={sector} onChange={(e) => setSector(e.target.value)} style={{ maxWidth: 280 }}>
            <option value="all">All industries</option>
            {step.sectors.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
      ) : null}
      {rows.map((f) => {
        const chosen = f.options.find((o) => o.kind === pick[f.title]);
        return (
          <div key={f.title} style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
            <div className="small"><strong>{f.title}</strong>{f.page ? <span className="faint"> · p. {f.page}</span> : null}{f.added ? <span className="faint"> · added by you</span> : null}
              {f.added && <button type="button" className="ghost sm" style={{ marginLeft: 6 }} onClick={() => setRows(rows.filter((r) => r.title !== f.title))}>Remove</button>}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              {f.options.filter((o) => fits(o) || pick[f.title] === o.kind).map((o, i) => (
                <label key={o.kind} className={`chip ${pick[f.title] === o.kind ? "ok" : "mute"}`} style={{ cursor: "pointer", fontWeight: pick[f.title] === o.kind ? 700 : 400 }} title={o.when || undefined}>
                  <input type="radio" name={f.title} checked={pick[f.title] === o.kind} onChange={() => setPick({ ...pick, [f.title]: o.kind })} style={{ display: "none" }} />
                  {o.label}{i === 0 && !f.added ? " (best fit)" : ""}
                </label>
              ))}
            </div>
            {chosen?.preview && (
              <div style={{ marginTop: 4 }}>
                <button type="button" className="ghost sm" onClick={() => setOpen(open === f.title ? null : f.title)}>{open === f.title ? "Hide preview" : "Preview this version"}</button>
                {chosen.when && <span className="tiny faint" style={{ marginLeft: 8 }}>{chosen.when}</span>}
                {open === f.title && <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, margin: "6px 0 0", maxHeight: 320, overflow: "auto" }}>{chosen.preview.replace(/⟦\/?table[^⟧]*⟧/g, "").replace(/\|/g, " · ")}</pre>}
              </div>
            )}
          </div>
        );
      })}
      {step.catalog?.length ? (
        <details style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
          <summary className="small" style={{ cursor: "pointer" }}>＋ Add a format the tender didn't list (from {step.catalog.length} formats other tenders use)</summary>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. affidavit, power of attorney, solvency" style={{ margin: "6px 0" }} />
          <div className="row" style={{ gap: 6 }}>
            {more.map((e) => <button key={e.id} type="button" className="ghost sm" onClick={() => add(e)}>{e.heading} · {e.seen_count}</button>)}
            {!more.length && <span className="tiny faint">Nothing matches{sector !== "all" ? " in this industry — try All industries" : ""}.</span>}
          </div>
        </details>
      ) : null}
      <div className="row" style={{ gap: 8 }}>
        <button disabled={busy} onClick={() => send(`Use these ${list.length} formats${free ? ` (${free} ready versions, filled free)` : ""}${ai ? ` (${ai} by AI)` : ""}`, list)}>Confirm formats</button>
      </div>
    </div>
  );
}
