"use client";
import { useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { recordTenderFile, readTender } from "./readActions";

export function UploadTenderFiles({ tenderId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function onFiles(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setError(""); setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      if (f.type !== "application/pdf") { setError(`${f.name} is not a PDF.`); continue; }
      if (f.size > 50 * 1024 * 1024) { setError(`${f.name} is larger than 50 MB.`); continue; }
      const path = `${tenderId}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: up } = await supabase.storage.from("tender-docs").upload(path, f, { contentType: "application/pdf" });
      if (up) { setError(up.message); continue; }
      const r = await recordTenderFile({ tenderId, path, name: f.name, size: f.size });
      if (r?.error) setError(r.error);
    }
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }
  return (
    <div className="stack-sm">
      <label className="btn ghost" style={{ alignSelf: "start", color: "var(--ink)", marginBottom: 0, cursor: busy ? "default" : "pointer" }}>
        {busy ? "Uploading…" : "Upload tender PDFs"}
        <input type="file" accept="application/pdf" multiple onChange={onFiles} disabled={busy} style={{ display: "none" }} />
      </label>
      <p className="tiny faint" style={{ margin: 0 }}>NIT, ITB, corrigenda, formats — download them from the portal (it asks for a captcha) and drop them here. Uploaded files are shared with every Dhandha user bidding on this tender.</p>
      {error && <p className="error small">{error}</p>}
    </div>
  );
}

export function ReadButtons({ matchId, aiReady, hasFiles }) {
  const [state, action, pending] = useActionState(readTender, {});
  return (
    <form action={action} className="stack-sm">
      <input type="hidden" name="match_id" value={matchId} />
      <div className="row">
        <button name="mode" value="basic" className="ghost" disabled={pending || !hasFiles}>{pending ? "Reading…" : "Read (free engine · 10 credits)"}</button>
        <button name="mode" value="ai" disabled={pending || !hasFiles || !aiReady} title={aiReady ? "" : "AI not configured yet"}>{pending ? "Reading…" : "Read with AI · 99 credits"}</button>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>
        The free engine reads typed English tenders. AI is needed for scanned, Hindi or regional-language documents, and gives a summary and the full list of formats.
        {aiReady ? " AI uses the cheapest engine that can read it." : " AI reading switches on once an AI key is added."}
      </p>
      {state?.error && <p className="error small">{state.error}</p>}
      {state?.message && <p className="success small">{state.message}</p>}
    </form>
  );
}
