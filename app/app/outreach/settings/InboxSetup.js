"use client";
import { useState, useTransition } from "react";
import { saveInboxSetup } from "../actions";

// Receive WhatsApp replies in Dhandha: the webhook address and verify token to paste into the Meta app, the app secret
// (so we can check that messages really come from Meta), auto-reply and who gets new conversations.
export default function InboxSetup({ origin, initial }) {
  const [s, setS] = useState(initial || {});
  const [secret, setSecret] = useState("");
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const save = (extra = {}) => start(async () => {
    setNote(null);
    const r = await saveInboxSetup({ secret, auto_reply: s.auto_reply || "", auto_when: s.auto_when || "off", assign: s.assign || "owner", ...extra });
    if (r.error) setNote({ bad: r.error }); else { setS(r.data); setSecret(""); setNote({ ok: "Saved." }); }
  });
  const url = s.hook_token ? `${origin}/api/whatsapp/webhook/${s.hook_token}` : null;
  return (
    <div className="panel stack-sm" id="inbox">
      <h3 style={{ margin: 0 }}>Receive replies (WhatsApp inbox)</h3>
      <p className="small muted" style={{ margin: 0 }}>Clients&apos; replies to your WhatsApp number arrive in Dhandha&apos;s WhatsApp inbox, filed under the lead, and stop that lead&apos;s playbook.</p>
      {!url ? (
        <button type="button" className="sm" onClick={() => save()} disabled={pending} aria-busy={pending}>Create my webhook address</button>
      ) : (
        <>
          <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
            <li>Meta for Developers → your app → WhatsApp → Configuration → Webhook → Edit.</li>
            <li>Callback URL: <code style={{ wordBreak: "break-all" }}>{url}</code> <button type="button" className="ghost sm" onClick={() => navigator.clipboard?.writeText(url)}>Copy</button></li>
            <li>Verify token: <code>{s.verify_token}</code> <button type="button" className="ghost sm" onClick={() => navigator.clipboard?.writeText(s.verify_token)}>Copy</button> → Verify and save.</li>
            <li>Under Webhook fields, subscribe to <strong>messages</strong>.</li>
            <li>App settings → Basic → App secret → paste it below (stored encrypted; used only to check messages really come from Meta).</li>
          </ol>
          <label>App secret {s.has_secret ? <span className="chip ok">saved</span> : <span className="chip warn">needed</span>}
            <input type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={s.has_secret ? "Saved — paste a new one to replace it" : "32 characters from App settings → Basic"} /></label>
          <div className="grid-2">
            <label>Auto-reply
              <select value={s.auto_when || "off"} onChange={(e) => setS({ ...s, auto_when: e.target.value })}>
                <option value="off">Off</option><option value="first">To a new conversation</option>
                <option value="outside_hours">Outside office hours</option><option value="always">To every message (at most every 12 h)</option>
              </select></label>
            <label>New conversations go to
              <select value={s.assign || "owner"} onChange={(e) => setS({ ...s, assign: e.target.value })}>
                <option value="owner">The lead&apos;s owner (else round-robin)</option><option value="round_robin">Round-robin across the team</option><option value="unassigned">Nobody (pick from the inbox)</option>
              </select></label>
          </div>
          {s.auto_when && s.auto_when !== "off" && (
            <label>Auto-reply message<textarea rows={3} value={s.auto_reply || ""} onChange={(e) => setS({ ...s, auto_reply: e.target.value })} maxLength={1000}
              placeholder="Thank you for your message! Our team will reply shortly. Office hours: Mon–Sat, 9:30 am – 6:30 pm." /></label>
          )}
          <p className="tiny faint" style={{ margin: 0 }}>Office hours come from your first automatic Lead Playbook (default Mon–Sat 9:30–18:30).</p>
          <div><button type="button" className="sm" onClick={() => save()} disabled={pending} aria-busy={pending}>Save</button></div>
        </>
      )}
      {note?.bad && <p className="error" style={{ margin: 0 }}>{note.bad}</p>}
      {note?.ok && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>{note.ok}</p>}
    </div>
  );
}
