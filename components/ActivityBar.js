"use client";
import { useEffect, useState } from "react";

// A thin bar at the top of every screen while anything is working: saves, page changes, AI calls, uploads.
// It counts this site's own requests (server actions, page loads, API routes); background polling of the
// database (another address) does not count. It appears only after 200 ms, so instant actions don't flicker.
export default function ActivityBar() {
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (window.__dhActivity) return;
    window.__dhActivity = true;
    let inFlight = 0, timer = null;
    const update = () => {
      clearTimeout(timer);
      if (inFlight > 0) timer = setTimeout(() => setBusy(true), 200);
      else setBusy(false);
    };
    const mine = (input) => {
      try { return new URL(typeof input === "string" ? input : input.url, location.href).origin === location.origin; } catch { return false; }
    };
    const orig = window.fetch;
    window.fetch = function (input, init) {
      if (!mine(input)) return orig.call(this, input, init);
      inFlight++; update();
      return orig.call(this, input, init).finally(() => { inFlight = Math.max(0, inFlight - 1); update(); });
    };
    // a plain link or form that reloads the page
    const leaving = () => { inFlight++; update(); };
    window.addEventListener("beforeunload", leaving);
  }, []);
  return busy ? <div className="activity-bar" role="progressbar" aria-label="Working" /> : null;
}
