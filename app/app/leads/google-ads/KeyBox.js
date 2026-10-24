"use client";
import { useState } from "react";
import { newGoogleAdsKey } from "../googleActions";

// Make (or replace) the webhook key and show the address + key once, to paste into Google Ads.
export default function KeyBox({ origin, token, connected }) {
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  async function make() {
    if (connected && !confirm("Make a new key? The current key in Google Ads will stop working until you paste the new one.")) return;
    setBusy(true); setRes(await newGoogleAdsKey()); setBusy(false);
  }
  const url = `${origin}/api/google-ads/lead/${res?.token || token || "…"}`;
  const copy = (t) => navigator.clipboard?.writeText(t);
  return (
    <div className="stack-sm">
      {(token || res?.token) && (
        <div><label>Webhook URL</label><div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><input readOnly value={url} onFocus={(e) => e.target.select()} /><button type="button" className="sm ghost" onClick={() => copy(url)}>Copy</button></div></div>
      )}
      {res?.key && (
        <div className="notice info" style={{ display: "block" }}>
          <label>Key — copy it now, it is shown only once</label>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}><input readOnly value={res.key} onFocus={(e) => e.target.select()} className="num" /><button type="button" className="sm" onClick={() => copy(res.key)}>Copy</button></div>
        </div>
      )}
      {res?.error && <p className="error small" style={{ margin: 0 }}>{res.error}</p>}
      <div><button type="button" className={connected ? "sm ghost" : "sm"} disabled={busy} aria-busy={busy} onClick={make}>{connected ? "Make a new key" : "Create my webhook key"}</button></div>
    </div>
  );
}
