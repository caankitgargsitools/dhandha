"use client";
import { useState } from "react";

// A pending invite's link, to copy or send on WhatsApp (Dhandha does not email invites until email sending is on).
export default function InviteShare({ url, name }) {
  const [copied, setCopied] = useState(false);
  const text = `Hi${name ? ` ${name.split(" ")[0]}` : ""}, I've added you to our Dhandha workspace. Sign up with this email here: ${url}`;
  return (
    <span className="row" style={{ gap: 6 }}>
      <button type="button" className="sm ghost" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
      <a className="btn sm ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
    </span>
  );
}
