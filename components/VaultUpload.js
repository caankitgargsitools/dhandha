"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Picks a PDF or photo and stores it in this company's private Vault folder; the form then saves the document and
// Dhandha reads it into the masters.
export default function VaultUpload({ tenantId, companyId }) {
  const [st, setSt] = useState({});
  async function pick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return setSt({ error: "Files up to 25 MB." });
    if (!/pdf|jpe?g|png|webp/i.test(file.type || file.name)) return setSt({ error: "Upload a PDF or a photo (JPG / PNG)." });
    setSt({ busy: true, name: file.name });
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${tenantId}/${companyId}/${Date.now()}-${safe}`;
    const { error } = await createClient().storage.from("vault-docs").upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (error) return setSt({ error: error.message });
    setSt({ done: true, path, name: file.name, mime: file.type || "" });
  }
  return (
    <div className="stack-sm">
      <label htmlFor="vault_file">Upload the file (PDF or photo) — Dhandha reads it into your Vault</label>
      <input id="vault_file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={pick} disabled={st.busy} />
      {st.busy && <p className="small" style={{ margin: 0 }}>Uploading {st.name}…</p>}
      {st.error && <p className="error" style={{ margin: 0 }}>{st.error}</p>}
      {st.done && <p className="small" style={{ margin: 0, color: "var(--ok)" }}>Uploaded {st.name}. Press “Add document” and it is read at once.</p>}
      <input type="hidden" name="storage_path" value={st.path || ""} />
      <input type="hidden" name="file_name" value={st.name || ""} />
      <input type="hidden" name="mime" value={st.mime || ""} />
    </div>
  );
}
