"use client";
import { useState, useTransition } from "react";
import { setTenderStatus } from "./actions";
import { SKIP_REASONS } from "@/lib/skipReasons";

// A stage button (Shortlist / Skip / Restore / Preparing…) that shows why a change failed instead of doing nothing.
export default function StageButton({ id, status, className = "sm ghost", children }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const [asking, setAsking] = useState(false); // "Skip" asks why first (brief §3.7)
  const go = (reason) => start(async () => {
    setError(null); setAsking(false);
    const fd = new FormData();
    fd.set("id", id); fd.set("status", status);
    if (reason) fd.set("reason", reason);
    try { const r = await setTenderStatus(fd); if (r?.error) setError(r.error); }
    catch (e) { setError(e.message || "Could not change the stage — try again."); }
  });
  return (
    <span className="stage-btn">
      {asking ? (
        <select autoFocus aria-label="Why skip this tender?" defaultValue="" onChange={(e) => e.target.value && go(e.target.value)} onBlur={() => setAsking(false)} className="sm">
          <option value="" disabled>Why skip?</option>
          {SKIP_REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      ) : (
        <button type="button" className={className} onClick={() => (status === "skipped" ? setAsking(true) : go())} disabled={pending} aria-busy={pending}>{children}</button>
      )}
      {error && <span className="tiny error" role="alert" style={{ display: "block" }}>{error}</span>}
    </span>
  );
}
