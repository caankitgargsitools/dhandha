"use client";
import { useState } from "react";
import { newEmailKey, saveEmailHook } from "../googleActions";
import { appsScript } from "@/lib/emailLead";

// Make (or replace) the mailbox key and show the ready Gmail script once, with the key inside it.
export function KeyAndScript({ origin, token, connected }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  async function make() {
    if (connected && !confirm("Make a new key? The script already in your Gmail stops working until you paste the new one.")) return;
    setBusy(true); setRes(await newEmailKey()); setBusy(false); setCopied(false);
  }
  const url = `${origin}/api/email/lead/${res?.token || token || "…"}`;
  const script = res?.key ? appsScript({ url, key: res.key }) : "";
  const copy = () => { navigator.clipboard?.writeText(script); setCopied(true); };
  return (
    <div className="stack-sm">
      {res?.key && (
        <div className="notice info stack-sm" style={{ display: "block" }}>
          <strong className="small">Your Gmail script — copy it now; the key inside is shown only once.</strong>
          <textarea readOnly value={script} rows={10} onFocus={(e) => e.target.select()} style={{ fontFamily: "ui-monospace, monospace", fontSize: 11 }} />
          <div className="row" style={{ gap: 8 }}><button type="button" className="sm" onClick={copy}>{copied ? "Copied ✓" : "Copy the script"}</button></div>
          <p className="tiny faint" style={{ margin: 0 }}>Other mail services: POST JSON {"{ from, subject, text, message_id }"} to <span className="num">{url}</span> with the header <span className="num">x-dhandha-key: {res.key}</span>.</p>
        </div>
      )}
      {res?.error && <p className="error small" style={{ margin: 0 }}>{res.error}</p>}
      <div><button type="button" className={connected ? "sm ghost" : "sm"} disabled={busy} aria-busy={busy} onClick={make}>{connected ? "Make a new key and script" : "Create my Gmail script"}</button></div>
    </div>
  );
}

export function Settings({ ownDomains, enabled }) {
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function save(e) {
    e.preventDefault();
    setBusy(true); const r = await saveEmailHook(new FormData(e.currentTarget)); setBusy(false);
    setMsg(r.error ? { error: r.error } : { ok: "Saved." });
  }
  return (
    <form onSubmit={save} className="stack-sm">
      <div><label htmlFor="em-dom">Your own email domains (never made into leads)</label><input id="em-dom" name="own_domains" defaultValue={(ownDomains || []).join(", ")} placeholder="e.g. gscindia.in" /></div>
      <label className="row small" style={{ gap: 8 }}><input type="checkbox" name="enabled" defaultChecked={enabled} style={{ width: "auto" }} />On — turn off to pause without removing the script</label>
      <div className="row" style={{ gap: 8 }}><button className="sm" disabled={busy} aria-busy={busy}>Save</button>{msg?.ok && <span className="small" style={{ color: "var(--ok)" }}>{msg.ok}</span>}{msg?.error && <span className="error small">{msg.error}</span>}</div>
    </form>
  );
}
