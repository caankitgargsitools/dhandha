"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { visitCheck } from "@/app/app/sales/actions";

// GPS check-in / check-out at a client visit: the phone's location (high accuracy) is the proof of visit.
export default function CheckIn({ meetingId, state }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const kind = state === "in" ? "out" : "in";
  function go() {
    if (!navigator.geolocation) { setMsg("This phone or browser cannot share its location."); return; }
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const r = await visitCheck(meetingId, kind, pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy || 0), note);
      setBusy(false);
      if (r?.error) setMsg(r.error); else { setNote(""); router.refresh(); }
    }, (e) => { setBusy(false); setMsg(e.code === 1 ? "Location is blocked — allow location for this site in the browser settings, then try again." : "Could not get your location — step outside or switch GPS on, then try again."); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  if (state === "out") return null;
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      {kind === "out" && <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened (optional)" maxLength={500} style={{ flex: "1 1 180px" }} />}
      <button type="button" className={`sm ${kind === "in" ? "" : "ghost"}`} disabled={busy} aria-busy={busy} onClick={go}>{busy ? "Getting location…" : kind === "in" ? "📍 Check in" : "📍 Check out"}</button>
      {msg && <span className="small error">{msg}</span>}
    </div>
  );
}
