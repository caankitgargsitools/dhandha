"use client";
import { useMemo, useState } from "react";
import { parseRule, searchCatalog } from "@/lib/taxonomy";
import { addCustomTaxonomy } from "@/app/app/tenders/taxonomyActions";

// the plain words of a service (rule syntax like "PMU + financ|…" or "- blocker" is not shown)
const words = (v) => [...new Set(v.kw.map((w) => parseRule(w).k))];
const Pending = ({ x }) => (x.custom && x.status !== "approved" ? <span className="chip warn plain tiny" style={{ marginLeft: 6 }} title="Only your workspace sees this until Dhandha approves it">only you · in review</span> : null);

// What a business does: it searches for its industry and builds its own list; only its industries are shown.
// It can add its own industry / sub-industry / service (works for it at once; Dhandha's admin reviews it for everyone).
// Posts the chosen service ids as "services". `tree` is the catalogue (built-in + approved + own additions).
export default function ServicePicker({ initial = [], tree: start = [] }) {
  const [tree, setTree] = useState(start);
  const [sel, setSel] = useState(new Set(initial));
  const [mine, setMine] = useState(() => new Set(start.filter((i) => i.subs.some((s) => s.services.some((v) => initial.includes(v.id)))).map((i) => i.id)));
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const results = useMemo(() => searchCatalog(tree, q, 25), [tree, q]);
  const toggle = (ids, on) => setSel((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const addIndustry = (id) => setMine((m) => new Set([...m, id]));
  const removeIndustry = (ind) => { toggle(ind.subs.flatMap((s) => s.services.map((v) => v.id)), false); setMine((m) => { const n = new Set(m); n.delete(ind.id); return n; }); };
  const shown = tree.filter((i) => mine.has(i.id));

  return (
    <div className="stack-sm">
      {[...sel].map((id) => <input key={id} type="hidden" name="services" value={id} />)}
      <div className="row between">
        <strong className="small">{shown.length ? "Your industries" : "Find your industry"}</strong>
        <span className="chip info">{sel.size} service{sel.size === 1 ? "" : "s"} selected</span>
      </div>
      <div>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} placeholder="Search your industry or service: audit, housekeeping, road, solar, insurance…" aria-label="Search industries and services" />
        {q.trim().length >= 2 && (
          <div className="panel" style={{ marginTop: 6, padding: 8, maxHeight: 340, overflowY: "auto" }}>
            {!results.length && <p className="small muted" style={{ margin: 6 }}>Nothing found for “{q}”. <button type="button" onClick={() => setAdding(true)} style={{ padding: 0, border: 0, background: "none", color: "var(--primary)", cursor: "pointer" }}>Add it yourself</button></p>}
            {results.map((r) => {
              const key = `${r.type}:${r.service?.id || r.sub?.id || r.industry.id}`;
              const label = r.type === "industry" ? <strong>{r.industry.label}</strong> : r.type === "sub" ? <>{r.sub.label} <span className="tiny faint">in {r.industry.label}</span></> : <>{r.service.label} <span className="tiny faint">{r.sub.label} · {r.industry.label}</span></>;
              const done = r.type === "service" ? sel.has(r.service.id) : r.type === "industry" && mine.has(r.industry.id);
              return (
                <div key={key} className="row between" style={{ padding: "6px 4px", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap", gap: 8 }}>
                  <span className="small" style={{ minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
                  <button type="button" className="sm ghost" disabled={done} onClick={() => {
                    addIndustry(r.industry.id);
                    if (r.type === "service") toggle([r.service.id], true);
                    if (r.type === "sub") toggle(r.sub.services.map((v) => v.id), true);
                    setQ("");
                  }}>{done ? "Added" : r.type === "industry" ? "Add industry" : r.type === "sub" ? "Add all" : "Add"}</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!shown.length && <p className="small muted" style={{ margin: 0 }}>Type what your business does above and add your industry. Only the industries you add are shown here.</p>}
      {shown.map((ind) => (
        <div key={ind.id} style={{ border: "1px solid var(--line)", borderRadius: 12, background: "var(--panel)", padding: "12px 14px" }} className="stack-sm">
          <div className="row between" style={{ flexWrap: "nowrap" }}>
            <strong>{ind.label}<Pending x={ind} /></strong>
            <button type="button" className="sm ghost" onClick={() => removeIndustry(ind)}>Remove industry</button>
          </div>
          {!ind.subs.length && <p className="tiny faint" style={{ margin: 0 }}>No services yet — add one with “Add your own” below.</p>}
          {ind.subs.map((sub) => {
            const sids = sub.services.map((v) => v.id);
            const all = sids.length > 0 && sids.every((id) => sel.has(id));
            return (
              <div key={sub.id}>
                <label className="row" style={{ gap: 8, margin: "0 0 6px", color: "var(--ink)", fontWeight: 700 }}>
                  <input type="checkbox" checked={all} disabled={!sids.length} onChange={(e) => toggle(sids, e.target.checked)} style={{ width: 16, height: 16 }} />{sub.label}<Pending x={sub} />
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 6, paddingLeft: 24 }}>
                  {sub.services.map((v) => (
                    <label key={v.id} className="row" style={{ gap: 8, margin: 0, color: "var(--ink)", fontWeight: 500, alignItems: "flex-start", flexWrap: "nowrap" }} title={words(v).join(", ")}>
                      <input type="checkbox" checked={sel.has(v.id)} onChange={(e) => toggle([v.id], e.target.checked)} style={{ width: 16, height: 16, marginTop: 3, flex: "none" }} />
                      <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{v.label}<Pending x={v} /><span className="tiny faint" style={{ display: "block" }}>{words(v).slice(0, 4).join(", ")}{words(v).length > 4 ? "…" : ""}</span></span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <details open={adding} onToggle={(e) => setAdding(e.currentTarget.open)} className="panel" style={{ padding: "10px 14px" }}>
        <summary className="small" style={{ cursor: "pointer" }}><strong>Add your own</strong> <span className="muted">— an industry, sub-industry or service that is not in the list</span></summary>
        <AddOwn tree={tree} onAdded={(rows, industryId) => {
          setTree((t) => mergeRows(t, rows));
          const svc = rows.find((r) => r.kind === "service");
          if (industryId) addIndustry(industryId);
          if (svc) toggle([`x.${svc.id}`], true);
          setAdding(false);
        }} />
      </details>
    </div>
  );
}

// put newly added rows into the local tree (same shape buildCatalog makes)
function mergeRows(tree, rows) {
  const t = tree.map((i) => ({ ...i, subs: i.subs.map((s) => ({ ...s, services: [...s.services] })) }));
  const mark = (r) => ({ custom: true, status: r.status, mine: true });
  for (const r of rows) {
    if (r.kind === "industry") t.push({ id: `x.${r.id}`, label: r.label, pack: null, subs: [], ...mark(r) });
    if (r.kind === "sub") t.find((i) => i.id === r.parent)?.subs.push({ id: `x.${r.id}`, label: r.label, services: [], ...mark(r) });
    if (r.kind === "service") for (const i of t) { const s = i.subs.find((x) => x.id === r.parent); if (s) s.services.push({ id: `x.${r.id}`, label: r.label, kw: r.keywords?.length ? r.keywords : [r.label], ...mark(r) }); }
  }
  return t;
}

// Industry (pick or new) → sub-industry (pick or new) → service with the words tenders use for it.
function AddOwn({ tree, onAdded }) {
  const [indId, setIndId] = useState("");
  const [newInd, setNewInd] = useState("");
  const [subId, setSubId] = useState("");
  const [newSub, setNewSub] = useState("");
  const [svc, setSvc] = useState("");
  const [kw, setKw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ind = tree.find((i) => i.id === indId);
  const needSub = indId === "new" || subId === "new";
  const ready = indId && (indId === "new" ? newInd.trim() && newSub.trim() : subId && (subId !== "new" || newSub.trim())) && (svc.trim() || needSub);
  async function add() {
    setErr(null); setBusy(true);
    const made = [];
    let industry = indId;
    try {
      if (indId === "new") {
        const r = await addCustomTaxonomy({ kind: "industry", label: newInd });
        if (r.error) throw new Error(r.error);
        made.push(r.row); industry = `x.${r.row.id}`;
      }
      let sub = subId;
      if (needSub) {
        const r = await addCustomTaxonomy({ kind: "sub", parent: industry, label: newSub });
        if (r.error) throw new Error(r.error);
        made.push(r.row); sub = `x.${r.row.id}`;
      }
      if (svc.trim()) {
        const r = await addCustomTaxonomy({ kind: "service", parent: sub, label: svc, keywords: kw });
        if (r.error) throw new Error(r.error);
        made.push(r.row);
      }
      setIndId(""); setNewInd(""); setSubId(""); setNewSub(""); setSvc(""); setKw("");
    } catch (e) {
      setErr(e.message);
    }
    if (made.length) onAdded(made, industry);
    setBusy(false);
  }
  return (
    <div className="stack-sm" style={{ marginTop: 10 }}>
      <div className="form-grid">
        <div><label htmlFor="own-ind">Industry</label>
          <select id="own-ind" value={indId} onChange={(e) => { setIndId(e.target.value); setSubId(""); }}>
            <option value="">— pick —</option>{tree.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}<option value="new">+ A new industry…</option>
          </select>
          {indId === "new" && <input value={newInd} onChange={(e) => setNewInd(e.target.value)} placeholder="Industry name" style={{ marginTop: 6 }} />}</div>
        <div><label htmlFor="own-sub">Sub-industry</label>
          {indId === "new" ? <input id="own-sub" value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Sub-industry name" />
            : <select id="own-sub" value={subId} onChange={(e) => setSubId(e.target.value)} disabled={!ind}>
                <option value="">— pick —</option>{(ind?.subs || []).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}<option value="new">+ A new sub-industry…</option>
              </select>}
          {subId === "new" && <input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Sub-industry name" style={{ marginTop: 6 }} />}</div>
        <div><label htmlFor="own-svc">Service</label><input id="own-svc" value={svc} onChange={(e) => setSvc(e.target.value)} placeholder="e.g. Trust & society audits" /></div>
        <div><label htmlFor="own-kw">Words tenders use for it (comma separated)</label><input id="own-kw" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="trust audit, audit + trust|society" /></div>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>It works for you straight away — tick it and press Save below. Dhandha reviews additions; once approved, everyone can find them. Use “+” for words that must also appear, e.g. <em>audit + trust|society</em>.</p>
      {err && <p className="error small" style={{ margin: 0 }}>{err}</p>}
      <div><button type="button" className="sm" disabled={busy || !ready} aria-busy={busy} onClick={add}>Add</button></div>
    </div>
  );
}
