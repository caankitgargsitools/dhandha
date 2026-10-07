"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TwoFactor({ enabled }) {
  const [step, setStep] = useState(null); // { factorId, qr, secret }
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function start() {
    setError(""); setBusy(true);
    const { data: list } = await supabase.auth.mfa.listFactors();
    for (const f of list?.all || []) if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Dhandha ${Date.now()}` });
    setBusy(false);
    if (error) return setError(error.message);
    setStep({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verify(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: step.factorId, code: code.trim() });
    setBusy(false);
    if (error) return setError("That code did not work. Check the time on your phone and try the latest code.");
    setStep(null);
    router.refresh();
  }

  async function disable() {
    if (!confirm("Turn off two-factor login? Signature and seal uploads will be blocked until it is on again.")) return;
    setBusy(true);
    const { data } = await supabase.auth.mfa.listFactors();
    for (const f of data?.totp || []) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id });
      if (error) { setError(error.message); break; }
    }
    setBusy(false);
    router.refresh();
  }

  if (enabled) return (
    <div className="row"><span className="chip ok">On</span><button className="ghost" onClick={disable} disabled={busy}>Turn off</button>{error && <span className="error">{error}</span>}</div>
  );

  if (!step) return (
    <div className="row"><span className="chip bad">Off</span><button onClick={start} disabled={busy}>{busy ? "Starting…" : "Turn on"}</button>{error && <span className="error">{error}</span>}</div>
  );

  return (
    <form onSubmit={verify} className="stack">
      <p className="small" style={{ margin: 0 }}>1. Scan this QR code with your authenticator app.</p>
      <img src={step.qr} alt="QR code for authenticator app" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 8 }} />
      <p className="muted small" style={{ margin: 0 }}>Can't scan? Enter this key: <code>{step.secret}</code></p>
      <p className="small" style={{ margin: 0 }}>2. Enter the 6-digit code it shows.</p>
      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} required placeholder="123456" style={{ maxWidth: 200, fontSize: 20, letterSpacing: 4 }} />
      {error && <p className="error">{error}</p>}
      <div className="row"><button disabled={busy}>{busy ? "Checking…" : "Verify and turn on"}</button><button type="button" className="ghost" onClick={() => setStep(null)}>Cancel</button></div>
    </form>
  );
}
