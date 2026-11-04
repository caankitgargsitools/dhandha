"use client";
import { useState, useTransition } from "react";
import { setTenderStatus } from "./actions";

// A stage button (Shortlist / Skip / Restore / Preparing…) that shows why a change failed instead of doing nothing.
export default function StageButton({ id, status, className = "sm ghost", children }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(null);
  const go = () => start(async () => {
    setError(null);
    const fd = new FormData();
    fd.set("id", id); fd.set("status", status);
    try { const r = await setTenderStatus(fd); if (r?.error) setError(r.error); }
    catch (e) { setError(e.message || "Could not change the stage — try again."); }
  });
  return (
    <span className="stage-btn">
      <button type="button" className={className} onClick={go} disabled={pending} aria-busy={pending}>{children}</button>
      {error && <span className="tiny error" role="alert" style={{ display: "block" }}>{error}</span>}
    </span>
  );
}
