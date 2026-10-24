"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Progress";

const fmt = (m) => (m == null ? "—" : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m) % 60).padStart(2, "0")} min`);
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const CHIP = { live: ["ok", "Live"], captcha: ["warn", "Type the captcha"], requested: ["info", "Waiting for the worker"], opening: ["info", "Opening"], expired: ["bad", "Ended — re-verify"], failed: ["bad", "Could not open"], idle: ["mute", "Not started"] };

// One row per portal: state, the captcha to type, how long it has been live and what Dhandha has learned about it.
export default function Sessions({ initial }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [, tick] = useState(0);
  const db = useRef(null);
  const load = useCallback(async () => {
    db.current ||= createClient();
    const { data, error } = await db.current.rpc("portal_sessions_view");
    if (!error) setRows(data || []);
  }, []);
  useEffect(() => {
    const p = setInterval(load, 4000), t = setInterval(() => tick((x) => x + 1), 30000);
    return () => { clearInterval(p); clearInterval(t); };
  }, [load]);

  async function start(portals = null) {
    setBusy(portals ? portals[0] : "all"); setErr("");
    const { error } = await db.current.rpc("captcha_session_start", { p_portals: portals });
    if (error) setErr(error.message);
    setBusy(null); load();
  }
  async function answer(portal, value) {
    setBusy(portal); setErr("");
    const { error } = await db.current.rpc("answer_session_captcha", { p_portal: portal, p_answer: value });
    if (error) setErr(error.message);
    setBusy(null); load();
  }
  db.current ||= createClient();
  const live = rows.filter((r) => r.state === "live").length;
  const waiting = rows.filter((r) => r.state === "captcha");

  return (
    <div className="stack">
      <div className="panel row between">
        <div><strong>{live} of {rows.length} portals live</strong>{waiting.length > 0 && <span className="chip warn" style={{ marginLeft: 8 }}>{waiting.length} captcha{waiting.length === 1 ? "" : "s"} to type</span>}
          <div className="tiny faint">Live portals are left alone; use “Re-verify” on one to renew it.</div></div>
        <button onClick={() => start(null)} disabled={!!busy} aria-busy={busy === "all"}>Start today's session</button>
      </div>
      {err && <div className="notice bad small">{err}</div>}
      {waiting.length > 0 && (
        <div className="grid-2">
          {waiting.map((r) => (
            <form key={r.portal + r.captcha_seq} className="panel stack-sm" onSubmit={(e) => { e.preventDefault(); answer(r.portal, new FormData(e.currentTarget).get("a")); }}>
              <strong>{r.portal}</strong>
              <span className="tiny faint">{r.step}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.captcha_image} alt={`Captcha from ${r.portal}`} style={{ maxWidth: "100%", background: "#fff", borderRadius: 6, minHeight: 40, imageRendering: "pixelated" }} />
              <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input name="a" autoComplete="off" autoCapitalize="off" spellCheck={false} required maxLength={40} aria-label={`Captcha for ${r.portal}`} style={{ flex: 1, width: "auto" }} />
                <button className="sm" disabled={busy === r.portal} aria-busy={busy === r.portal}>Send</button>
              </div>
            </form>
          ))}
        </div>
      )}
      <div className="panel" style={{ padding: 0, overflowX: "auto" }}>
        <table>
          <thead><tr><th>Portal</th><th>State</th><th>Live for</th><th>Fetches carried</th><th>What we have learned</th><th>Re-verify by</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => {
              const [cls, label] = CHIP[r.state] || CHIP.idle;
              const l = r.learned || {};
              const age = r.live_since && r.state === "live" ? (Date.now() - Date.parse(r.live_since)) / 60000 : null;
              const learned = l.per_action ? "Asks a captcha for every fetch" : l.ended > 0 ? `Usually about ${fmt(Number(l.median_min))} (shortest ${fmt(Number(l.min_min))}; ${l.ended} session${l.ended === 1 ? "" : "s"} seen)` : l.longest_open_min ? `Still learning — longest so far ${fmt(Number(l.longest_open_min))}` : "Still learning";
              return (
                <tr key={r.portal}>
                  <td><strong>{r.portal}</strong>{r.error && <div className="tiny" style={{ color: "var(--blood)" }}>{r.error}</div>}</td>
                  <td><span className={`chip ${cls}`}>{["requested", "opening"].includes(r.state) && <Spinner />}{label}</span>{r.step && !["live", "idle"].includes(r.state) && <div className="tiny faint">{r.step}</div>}</td>
                  <td className="small">{age != null ? fmt(age) : "—"}</td>
                  <td className="small">{r.state === "live" ? r.served : "—"}</td>
                  <td className="small">{learned}</td>
                  <td className="small">{r.renew_by ? <span style={{ color: Date.parse(r.renew_by) < Date.now() ? "var(--blood)" : undefined }}>{time(r.renew_by)}</span> : "—"}</td>
                  <td><button className="ghost sm" disabled={!!busy || ["requested", "opening", "captcha"].includes(r.state)} aria-busy={busy === r.portal} onClick={() => start([r.portal])}>{r.state === "live" ? "Re-verify" : "Start"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>You get a phone alert when a portal asks for a captcha, before a session is likely to end (at 85% of what that portal usually allows) and when a portal ends one. A session also carries over when the documents worker restarts.</p>
    </div>
  );
}
