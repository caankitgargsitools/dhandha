"use client";
import { useState } from "react";
import { newMcpKey } from "./actions";

// Make a key and show it once, with the ready-to-paste address for each assistant.
export default function NewKey({ endpoint }) {
  const [name, setName] = useState("");
  const [write, setWrite] = useState(false);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const copy = (t) => navigator.clipboard?.writeText(t);
  async function make(e) {
    e.preventDefault();
    setBusy(true); setRes(await newMcpKey(name || "AI assistant", write)); setBusy(false);
  }
  const Row = ({ label, value }) => (
    <div><label>{label}</label><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><input readOnly value={value} onFocus={(e) => e.target.select()} style={{ fontSize: 12 }} /><button type="button" className="sm ghost" onClick={() => copy(value)}>Copy</button></div></div>
  );
  return (
    <div className="stack-sm">
      <form onSubmit={make} className="stack-sm">
        <div><label htmlFor="k-name">Which assistant</label><input id="k-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ankit's Claude" maxLength={60} /></div>
        <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} style={{ width: "auto" }} />It may also add leads (otherwise read-only)</label>
        <div><button disabled={busy} aria-busy={busy}>Create key</button></div>
      </form>
      {res?.error && <p className="error small" style={{ margin: 0 }}>{res.error}</p>}
      {res?.key && (
        <div className="notice info stack-sm" style={{ display: "block" }}>
          <strong className="small">Copy now — the key is shown only once.</strong>
          <Row label="Address with key (Claude, ChatGPT, Gemini — anything that asks for a URL)" value={`${endpoint}?key=${res.key}`} />
          <p className="tiny faint" style={{ margin: 0 }}>A key inside a link can end up in logs. Prefer the header (Claude Code, Cursor), keep link keys read-only, and disconnect and make a new one if a link is shared by mistake.</p>
          <Row label="Key alone (for an Authorization: Bearer header)" value={res.key} />
          <Row label="Claude Code" value={`claude mcp add --transport http dhandha ${endpoint} --header "Authorization: Bearer ${res.key}"`} />
        </div>
      )}
    </div>
  );
}
