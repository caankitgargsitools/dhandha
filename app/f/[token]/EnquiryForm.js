"use client";
import { useState } from "react";

export default function EnquiryForm({ token, askEmail }) {
  const [state, setState] = useState({});
  async function send(e) {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.currentTarget));
    if (!d.phone && !d.email) { setState({ error: `Please give a phone number${askEmail ? " or an email" : ""}.` }); return; }
    setState({ busy: true });
    const r = await fetch(`/api/widget/${token}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...d, page: "Dhandha enquiry page" }) }).then((x) => x.json()).catch(() => ({ error: "Could not send — please try again." }));
    setState(r.ok ? { done: true } : { error: r.error || "Could not send — please try again." });
  }
  if (state.done) return <p className="notice ok" style={{ margin: 0 }}>Thank you! We will get back to you soon.</p>;
  return (
    <form onSubmit={send} className="stack-sm">
      <div><label htmlFor="e-name">Your name</label><input id="e-name" name="name" required maxLength={120} /></div>
      <div><label htmlFor="e-co">Business (optional)</label><input id="e-co" name="company" maxLength={120} /></div>
      <div><label htmlFor="e-ph">Phone</label><input id="e-ph" name="phone" inputMode="tel" maxLength={20} /></div>
      {askEmail && <div><label htmlFor="e-em">Email</label><input id="e-em" name="email" type="email" maxLength={200} /></div>}
      <div><label htmlFor="e-msg">How can we help?</label><textarea id="e-msg" name="message" rows={3} maxLength={1500} /></div>
      <input name="website_url_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
      {state.error && <p className="error small" style={{ margin: 0 }}>{state.error}</p>}
      <button disabled={state.busy} aria-busy={state.busy}>Send</button>
    </form>
  );
}
