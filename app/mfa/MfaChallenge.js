"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallenge() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: lf } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === "verified");
    if (lf || !factor) {
      setError("No authenticator found for this account.");
      setBusy(false);
      return;
    }
    const { error: ve } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.trim() });
    if (ve) {
      setError("That code did not work. Try the latest code.");
      setBusy(false);
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="stack">
      <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code"
        maxLength={6} placeholder="123456" required style={{ fontSize: 22, letterSpacing: 6, textAlign: "center" }} />
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? "Checking…" : "Verify"}</button>
    </form>
  );
}
