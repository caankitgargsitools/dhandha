"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// "Captcha needed" card on every admin page. The crawler has stopped at a portal page that asks for a captcha;
// a person reads the picture and types it, and the crawler carries on with that answer. Shown to platform admins on
// admin pages and on /app pages. Covers the crawler's captchas and document fetches (tender assistant, prefetches).
export default function CaptchaDesk() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set());
  const hidden = useRef(new Set());
  const supabase = useRef(null);

  const load = useCallback(async () => {
    supabase.current ||= createClient();
    const [{ data }, { data: docs }, { data: sess }] = await Promise.all([
      supabase.current.from("crawler_captchas").select("id, portal, purpose, image, runner, asked_at, expires_at")
        .eq("status", "waiting").gt("expires_at", new Date().toISOString()).order("asked_at").limit(5),
      supabase.current.rpc("admin_doc_captchas"),
      supabase.current.rpc("portal_sessions_view"),
    ]);
    // document fetches waiting at a portal captcha (the fetcher waits about 9 minutes for an answer)
    const list = [...(data || []), ...(docs || []).filter((d) => !hidden.current.has(d.id)).map((d) => ({ id: d.id, doc: true, portal: d.portal, purpose: `${d.auto ? "Fetching in advance" : "A customer is waiting"}: ${d.title}`, image: d.image, asked_at: d.asked_at, expires_at: new Date(Date.parse(d.asked_at) + 9 * 60000).toISOString() })),
      // the admin's captcha session (Admin → Captcha session)
      ...(sess || []).filter((r) => r.state === "captcha" && r.captcha_image).map((r) => ({ id: `s:${r.portal}:${r.captcha_seq}`, session: r.portal, portal: r.portal, purpose: "Captcha session", image: r.captcha_image, asked_at: r.updated_at, expires_at: new Date(Date.parse(r.updated_at) + 9 * 60000).toISOString() }))];
    for (let i = list.length - 1; i >= 0; i--) if (list[i].session && hidden.current.has(list[i].id)) list.splice(i, 1);
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

  async function act(c, answer) {
    const id = c.id;
    setBusy(id); setErr("");
    let error = null;
    // skipping a document fetch only hides it here; the fetcher gives up after its wait and can be asked again
    if ((c.doc || c.session) && answer === null) hidden.current.add(id);
    else if (c.session) ({ error } = await supabase.current.rpc("answer_session_captcha", { p_portal: c.session, p_answer: answer }));
    else if (c.doc) ({ error } = await supabase.current.rpc("answer_doc_captcha", { p_job: id, p_answer: answer }));
    else ({ error } = answer === null ? await supabase.current.rpc("skip_captcha", { p_id: id }) : await supabase.current.rpc("answer_captcha", { p_id: id, p_answer: answer }));
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
          <form key={c.id} onSubmit={(e) => { e.preventDefault(); act(c, new FormData(e.currentTarget).get("answer")); }} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10 }} className="stack-sm">
            <div className="row between small"><strong>{c.portal}</strong><span className="tiny faint">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left</span></div>
            <div className="tiny faint">{c.purpose}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image} alt={`Captcha from ${c.portal}`} style={{ maxWidth: "100%", background: "#fff", borderRadius: 6, imageRendering: "pixelated", minHeight: 40 }} />
            <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
              <input name="answer" autoComplete="off" autoCapitalize="off" spellCheck={false} required maxLength={40} aria-label="Captcha text" autoFocus style={{ flex: 1, width: "auto" }} />
              <button className="sm" disabled={busy === c.id}>Send</button>
              <button type="button" className="ghost sm" disabled={busy === c.id} onClick={() => act(c, null)}>Skip</button>
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
