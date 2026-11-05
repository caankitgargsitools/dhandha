"use client";
import { useActionState, useState, useTransition } from "react";
import { tickUpload, markFiled } from "./filingActions";

const STATE = { ready: ["ok", "Ready"], draft: ["warn", "Draft only — sign it first"], missing: ["bad", "Not in your Vault"], expired: ["bad", "Expired"], expires_before_close: ["warn", "Expires before closing"] };

// The upload kit: tick each item as it goes up on the portal; then record the bid id.
export default function FilingPanel({ matchId, kit, urls = {}, filed = null, emd = null, canFile }) {
  const [ticks, setTicks] = useState(() => Object.fromEntries(kit.slots.map((s) => [s.key, s.ticked])));
  const [, start] = useTransition();
  const [err, setErr] = useState("");
  const [state, action, pending] = useActionState(markFiled, {});
  const tick = (key, on) => { setTicks((t) => ({ ...t, [key]: on })); start(async () => { const r = await tickUpload({ matchId, key, on }); if (r?.error) { setErr(r.error); setTicks((t) => ({ ...t, [key]: !on })); } }); };
  const done = kit.slots.filter((s) => ticks[s.key]).length;
  return (
    <div className="stack-sm">
      {kit.dsc && kit.dsc.state !== "ready" && (
        <div className={`notice ${kit.dsc.state === "expires_before_close" ? "" : "bad"} small`} style={{ margin: 0 }}>
          {kit.dsc.state === "missing" ? "No DSC (digital signature certificate) in your Vault — add its validity in Vault → Documents; the portal needs it to sign the bid." : kit.dsc.state === "expired" ? `Your DSC expired on ${kit.dsc.valid_until} — renew it before filing.` : `Your DSC expires on ${kit.dsc.valid_until}, before this bid closes — file early or renew it.`}
        </div>
      )}
      <div className="small muted">{done} of {kit.slots.length} uploaded. Tick each as it goes up on the portal.</div>
      <ul className="filing-list">
        {kit.slots.map((s) => (
          <li key={s.key}>
            <label className="row" style={{ gap: 8, flexWrap: "nowrap", alignItems: "flex-start" }}>
              <input type="checkbox" checked={!!ticks[s.key]} disabled={!canFile || s.state === "missing"} onChange={(e) => tick(s.key, e.target.checked)} style={{ marginTop: 3 }} />
              <span style={{ minWidth: 0 }}>
                <span className="small" style={{ fontWeight: 600 }}>{s.label}</span>{" "}
                <span className={`chip ${STATE[s.state][0]}`}>{STATE[s.state][1]}{s.valid_until && s.state !== "missing" ? ` · till ${s.valid_until}` : ""}</span>
                {urls[s.key] && <> <a className="tiny" href={urls[s.key]} target="_blank" rel="noreferrer">Download</a></>}
                {s.state === "missing" && s.code && <> <a className="tiny" href={`/app/vault/documents?type=${encodeURIComponent(s.code)}#add`}>Add to Vault</a></>}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {err && <p className="error small" role="alert">{err}</p>}
      {filed ? (
        <div className="notice ok small" style={{ margin: 0 }}>Filed{filed.at ? ` on ${new Date(filed.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : ""} — bid id / receipt <strong>{filed.ref}</strong>.</div>
      ) : canFile && (
        <form action={action} className="stack-sm" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 10 }}>
          <input type="hidden" name="match_id" value={matchId} />
          <div className="form-grid">
            <div><label htmlFor="sref">Bid id / receipt no. from the portal</label><input id="sref" name="submission_ref" required maxLength={120} placeholder="e.g. 2026_DHBVN_12345_1 / GEM/2026/B/…" /></div>
            {emd && emd.status !== "exempt" && (
              <>
                <div><label htmlFor="emode">EMD paid by</label><select id="emode" name="emd_mode" defaultValue="online"><option value="online">Online (net banking / NEFT)</option><option value="bg">Bank guarantee</option><option value="dd">Demand draft</option><option value="fdr">FDR</option><option value="other">Other</option></select></div>
                <div><label htmlFor="eref">EMD reference (UTR / BG no.)</label><input id="eref" name="emd_ref" maxLength={120} /></div>
              </>
            )}
          </div>
          {state?.error && <p className="error small" role="alert">{state.error}</p>}
          {state?.message && <p className="success small" role="status">{state.message}</p>}
          <div><button aria-busy={pending} disabled={pending}>{pending ? "Saving…" : "We have filed it"}</button></div>
        </form>
      )}
    </div>
  );
}
