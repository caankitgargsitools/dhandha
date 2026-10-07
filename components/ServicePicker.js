"use client";
import { useMemo, useState } from "react";
import { TAXONOMY } from "@/lib/taxonomy";

// Industry → sub-industry → service checklist. Posts the chosen service ids as "services".
export default function ServicePicker({ initial = [] }) {
  const [sel, setSel] = useState(new Set(initial));
  const [open, setOpen] = useState(() => new Set(TAXONOMY.filter((i) => i.subs.some((s) => s.services.some((v) => initial.includes(v.id)))).map((i) => i.id)));
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const toggle = (ids, on) => setSel((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const match = (v, s, i) => !query || [v.label, s.label, i.label, ...v.kw].some((t) => t.toLowerCase().includes(query));
  const visible = useMemo(() => TAXONOMY.map((i) => ({ ...i, subs: i.subs.map((s) => ({ ...s, services: s.services.filter((v) => match(v, s, i)) })).filter((s) => s.services.length) })).filter((i) => i.subs.length), [query]);

  return (
    <div className="stack-sm">
      {[...sel].map((id) => <input key={id} type="hidden" name="services" value={id} />)}
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: road, audit, CCTV, housekeeping, solar…" aria-label="Search services" />
        <span className="chip info" style={{ flex: "none" }}>{sel.size} selected</span>
      </div>
      {visible.map((ind) => {
        const ids = ind.subs.flatMap((s) => s.services.map((v) => v.id));
        const n = ids.filter((id) => sel.has(id)).length;
        const isOpen = open.has(ind.id) || !!query;
        return (
          <div key={ind.id} style={{ border: "1px solid var(--line)", borderRadius: 12, background: n ? "var(--marigold-soft)" : "var(--panel)" }}>
            <div className="row between" style={{ padding: "12px 14px", flexWrap: "nowrap", cursor: "pointer" }}
              onClick={() => setOpen((p) => { const x = new Set(p); x.has(ind.id) ? x.delete(ind.id) : x.add(ind.id); return x; })}>
              <strong>{ind.label}</strong>
              <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                {n > 0 && <span className="chip warn">{n} of {ids.length}</span>}
                <span className="faint small">{isOpen ? "Hide" : "Show"}</span>
              </span>
            </div>
            {isOpen && (
              <div style={{ padding: "0 14px 14px", display: "grid", gap: 12 }}>
                <div className="row" style={{ gap: 8 }}>
                  <button type="button" className="ghost sm" onClick={() => toggle(ids, true)}>Select all</button>
                  {n > 0 && <button type="button" className="ghost sm" onClick={() => toggle(ids, false)}>Clear</button>}
                </div>
                {ind.subs.map((sub) => {
                  const sids = sub.services.map((v) => v.id);
                  const all = sids.every((id) => sel.has(id));
                  return (
                    <div key={sub.id}>
                      <label className="row" style={{ gap: 8, margin: "0 0 6px", color: "var(--ink)", fontWeight: 700 }}>
                        <input type="checkbox" checked={all} onChange={(e) => toggle(sids, e.target.checked)} style={{ width: 16, height: 16 }} />{sub.label}
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 6, paddingLeft: 24 }}>
                        {sub.services.map((v) => (
                          <label key={v.id} className="row" style={{ gap: 8, margin: 0, color: "var(--ink)", fontWeight: 500, alignItems: "flex-start", flexWrap: "nowrap" }} title={v.kw.join(", ")}>
                            <input type="checkbox" checked={sel.has(v.id)} onChange={(e) => toggle([v.id], e.target.checked)} style={{ width: 16, height: 16, marginTop: 3, flex: "none" }} />
                            <span>{v.label}<span className="tiny faint" style={{ display: "block" }}>{v.kw.slice(0, 4).join(", ")}…</span></span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!visible.length && <p className="muted small">Nothing matches “{q}”. Add it under “Also match these words” below.</p>}
    </div>
  );
}
