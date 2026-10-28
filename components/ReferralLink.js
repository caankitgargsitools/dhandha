"use client";
import { useState, useTransition } from "react";
import { getReferralLink } from "@/app/app/crm/winback/actions";

// On a customer's lead page: their personal referral link to copy or send on WhatsApp.
export default function ReferralLink({ leadId, phone, name }) {
  const [link, setLink] = useState(null);
  const [err, setErr] = useState(null);
  const [pending, start] = useTransition();
  const get = () => start(async () => { const r = await getReferralLink(leadId); r.error ? setErr(r.error) : setLink(r.link); });
  if (!link) return <button type="button" className="ghost sm" onClick={get} disabled={pending} aria-busy={pending} title={err || "A link where this customer can refer friends"}>Referral link</button>;
  const ten = String(phone || "").replace(/\D/g, "").slice(-10);
  const msg = encodeURIComponent(`Thank you for working with us! If you know anyone who could use our services, you can share their details here: ${link}`);
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="ghost sm" onClick={() => navigator.clipboard?.writeText(link)}>Copy referral link</button>
      {ten.length === 10 && <a className="btn ghost sm" href={`https://wa.me/91${ten}?text=${msg}`} target="_blank" rel="noreferrer">Send to {name || "them"} on WhatsApp</a>}
    </span>
  );
}
