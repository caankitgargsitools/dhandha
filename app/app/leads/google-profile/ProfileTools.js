"use client";
import { useState } from "react";
import { findMyBusiness, refreshProfile } from "../googleActions";
import { Spinner } from "@/components/Progress";

// Find your own business on Google and link it; or refresh the numbers.
export default function ProfileTools({ linked }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [res, setRes] = useState(null);
  const [msg, setMsg] = useState(null);
  async function search() { setBusy("find"); setRes(await findMyBusiness(q)); setBusy(""); }
  async function pick(id) { setBusy(id); const r = await refreshProfile(id); setBusy(""); setMsg(r.error ? { error: r.error } : { ok: "Linked." }); if (!r.error) setRes(null); }
  async function refresh() { setBusy("refresh"); const r = await refreshProfile(); setBusy(""); setMsg(r.error ? { error: r.error } : { ok: "Updated from Google." }); }
  return (
    <div className="stack-sm">
      {linked && <div><button type="button" className="sm ghost" disabled={!!busy} aria-busy={busy === "refresh"} onClick={refresh}>Refresh from Google</button></div>}
      <details open={!linked}>
        <summary className="small" style={{ cursor: "pointer" }}><strong>{linked ? "Link a different listing" : "Find your business on Google"}</strong></summary>
        <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: "nowrap" }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Business name and city" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())} />
          <button type="button" className="sm" disabled={!!busy} aria-busy={busy === "find"} onClick={search}>Search</button>
        </div>
        {busy === "find" && <Spinner label="Searching Google…" />}
        {res?.error && <p className="error small">{res.error}</p>}
        {res?.places && !res.places.length && <p className="small muted">Nothing found — try the exact name on your Google listing.</p>}
        {(res?.places || []).map((p) => (
          <div key={p.id} className="row between" style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 0", flexWrap: "nowrap", gap: 8 }}>
            <span className="small"><strong>{p.name}</strong>{p.rating ? ` · ★ ${p.rating} (${p.reviews})` : ""}<br /><span className="tiny faint">{p.address}</span></span>
            <button type="button" className="sm" disabled={!!busy} aria-busy={busy === p.id} onClick={() => pick(p.id)}>This is us</button>
          </div>
        ))}
      </details>
      {msg?.error && <p className="error small" style={{ margin: 0 }}>{msg.error}</p>}
      {msg?.ok && <p className="success small" style={{ margin: 0 }}>{msg.ok}</p>}
    </div>
  );
}
