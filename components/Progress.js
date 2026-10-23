"use client";
import { useEffect, useState } from "react";

// Working indicators. <Spinner /> when the time is unknown; <TimedProgress seconds={40} /> when we know roughly
// how long it takes: the bar fills towards 95% over that time and shows the seconds left (it never claims 100%
// before the work is really done).
export function Spinner({ size = 14, label }) {
  return (
    <span className="row" style={{ gap: 8, display: "inline-flex", alignItems: "center" }}>
      <span className="spinner" aria-hidden style={{ width: size, height: size }} />
      {label && <span className="small">{label}</span>}
      {!label && <span className="sr-only">Working</span>}
    </span>
  );
}

export function TimedProgress({ seconds, label }) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setT((Date.now() - start) / 1000), 250);
    return () => clearInterval(id);
  }, []);
  const pct = Math.min(95, (t / seconds) * 90 + (t > seconds ? Math.min(5, (t - seconds) / seconds * 5) : 0));
  const left = Math.max(0, Math.round(seconds - t));
  return (
    <div className="stack-sm" style={{ gap: 4, width: "100%", maxWidth: 420 }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label || "Working"}>
      <div className="row between tiny"><span>{label || "Working…"}</span><span className="faint">{left > 0 ? `about ${left} s left` : "almost done…"}</span></div>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}
