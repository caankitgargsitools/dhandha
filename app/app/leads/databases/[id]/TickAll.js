"use client";

export default function TickAll() {
  const tick = (on) => (e) => e.currentTarget.closest("form").querySelectorAll("input[name=rec]").forEach((c) => { c.checked = on; });
  return <div className="row" style={{ gap: 6 }}><button type="button" className="ghost sm" onClick={tick(true)}>Tick this page</button><button type="button" className="ghost sm" onClick={tick(false)}>Clear</button></div>;
}
