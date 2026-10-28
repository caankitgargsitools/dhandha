"use client";
import { useState, useTransition } from "react";
import { enrichLeads } from "@/app/app/leads/actions";

// Find missing emails / phones with the workspace's Apollo key — one lead (ids) or the best 25 without an email.
export default function EnrichButton({ ids = null, label = "Find email / phone (Apollo)" }) {
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const run = () => start(async () => { const r = await enrichLeads(ids); setNote(r.found ? { ok: `Found details for ${r.found} of ${r.tried}.` } : { bad: r.error }); });
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="ghost sm" onClick={run} disabled={pending} aria-busy={pending}>{pending ? "Looking up…" : label}</button>
      {note?.ok && <span className="small" style={{ color: "var(--ok)" }}>{note.ok}</span>}
      {note?.bad && <span className="small error">{note.bad}</span>}
    </span>
  );
}
