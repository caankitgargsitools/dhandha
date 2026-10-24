"use client";
import { useState } from "react";
import { inviteRep } from "../actions";
import InviteShare from "@/components/InviteShare";

// "Invite to Dhandha" for a salesperson without a login: creates the invite and shows the link to send.
export default function InviteRep({ repId, email: start, name }) {
  const [email, setEmail] = useState(start || "");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  async function go() { setBusy(true); setRes(await inviteRep({ repId, email })); setBusy(false); }
  if (res?.link) return (
    <div className="notice info" style={{ display: "block" }}>
      <div className="small"><strong>Invite ready for {name}.</strong> Send them this link — they sign up with {email} and are linked here automatically.</div>
      <div style={{ marginTop: 6 }}><InviteShare url={res.link} name={name} /></div>
    </div>
  );
  return (
    <div className="stack-sm">
      <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`${name}'s email`} aria-label={`${name}'s email`} />
        <button type="button" className="sm" disabled={busy || !email.trim()} aria-busy={busy} onClick={go}>Invite to Dhandha</button>
      </div>
      {res?.error && <p className="error small" style={{ margin: 0 }}>{res.error}</p>}
      {res?.message && <p className="success small" style={{ margin: 0 }}>{res.message}</p>}
    </div>
  );
}
