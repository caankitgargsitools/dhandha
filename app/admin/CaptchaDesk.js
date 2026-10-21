"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Captcha needed" card on every admin page. The crawler has stopped at a portal page that asks for a captcha;
// a person reads the picture and types it, and the crawler carries on with that answer.
export default function CaptchaDesk() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set());
  const supabase = useRef(null);

  const load = useCallback(async () => {
    supabase.current ||= createClient();
    const { data } = await supabase.current.from("crawler_captchas").select("id, portal, purpose, image, runner, asked_at, expires_at")
      .eq("status", "waiting").gt("expires_at", new Date().toISOString()).order("asked_at").limit(5);
    const list = data || [];
    const fresh = list.filter((c) => !seen.current.has(c.id));
    if (fresh.length) {
      fresh.forEach((c) => seen.current.add(c.id));
      chime();
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) new Notification("Dhandha: captcha needed", { body: `${fresh[0].portal} — ${fresh[0].purpose}` });
    }
    setItems(list);
  }, []);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [load]);

  async function act(id, answer) {
    setBusy(id); setErr("");
    const { error } = answer === null ? await supabase.current.rpc("skip_captcha", { p_id: id }) : await supabase.current.rpc("answer_captcha", { p_id: id, p_answer: answer });
    if (error) setErr(error.message);
    setBusy(null);
    load();
  }

  if (!items.length) return null;
  const ask = () => typeof Notification !== "undefined" && Notification.permission === "default" && Notification.requestPermission();
  return (
    <div role="alertdialog" aria-label="Captcha needed" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 60, width: "min(360px, calc(100vw - 32px))", maxHeight: "80vh", overflow: "auto" }} className="panel stack-sm">
      <div className="panel-head"><h3 style={{ fontSize: 16 }}>Captcha needed <span className="chip warn" style={{ marginLeft: 6 }}>{items.length}</span></h3>
        {typeof Notification !== "undefined" && Notification.permission === "default" && <button className="ghost sm" onClick={ask}>Alert me</button>}</div>
      <p className="tiny muted" style={{ margin: 0 }}>The crawler is waiting at a portal page. Type exactly what the picture shows and press Enter.</p>
      {err && <div className="tiny" style={{ color: "var(--blood)" }}>{err}</div>}
      {items.map((c) => {
        const left = Math.max(0, Math.round((Date.parse(c.expires_at) - now) / 1000));
        return (
          <form key={c.id} onSubmit={(e) => { e.preventDefault(); act(c.id, new FormData(e.currentTarget).get("answer")); }} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }} className="stack-sm">
            <div className="row between small"><strong>{c.portal}</strong><span className="tiny faint">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</span></div>
            <div className="tiny faint">{c.purpose}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={`Captcha from ${c.portal}`} style={{ maxWidth: "100%", background: "#fff", borderRadius: 6, imageRendering: "pixelated", minHeight: 40 }} />
            <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
              <input name="answer" autoComplete="off" autoCapitalize="off" spellCheck={false} required maxLength={40} aria-label="Captcha text" autoFocus style={{ flex: 1, width: "auto" }} />
              <button className="sm" disabled={busy === c.id}>Send</button>
              <button type="button" className="ghost sm" disabled={busy === c.id} onClick={() => act(c.id, null)}>Skip</button>
            </div>
          </form>
        );
      })}
    </div>
  );
}

function chime() {
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880].forEach((f, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0.12, a.currentTime + i * 0.18); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + i * 0.18 + 0.16);
      o.connect(g).connect(a.destination); o.start(a.currentTime + i * 0.18); o.stop(a.currentTime + i * 0.18 + 0.17);
    });
  } catch {}
}
