"use client";
import { useState } from "react";
import { TimedProgress } from "@/components/Progress";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { processDataset } from "./actions";

// Upload a database: the file goes straight to private storage, then the server reads and loads it.
export default function Uploader() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [eta, setEta] = useState(null); // seconds expected for this file (upload + reading + loading rows)
  const [msg, setMsg] = useState(null);
  const [audience, setAudience] = useState("business");
  async function submit(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("file");
    if (!file?.size) return setMsg({ error: "Choose a file." });
    if (file.size > 50 * 1024 * 1024) return setMsg({ error: "Keep the file under 50 MB; split bigger databases." });
    const form = e.currentTarget;
    setBusy(true); setMsg({ note: "Uploading…" }); setEta(Math.round(8 + (file.size / (1024 * 1024)) * 4));
    try {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await createClient().storage.from("datasets").upload(path, file, { contentType: file.type || "text/csv" });
      if (error) return setMsg({ error: error.message });
      setMsg({ note: "Reading and loading the records…" });
      const r = await processDataset({ path, fileName: file.name, name: f.get("name"), source_label: f.get("source_label"), audience: f.get("audience"),
        lawful_basis: f.get("lawful_basis"), source_note: f.get("source_note"), price: f.get("price"), declared: f.get("declared") === "on" });
      setMsg(r || { error: "No answer from the server. Check the list below before trying again." });
      if (r && !r.error) { form.reset(); router.refresh(); }
    } catch (err) {
      setMsg({ error: `The upload stopped: ${err?.message || "network error"}. Check the list below before trying again.` });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="stack-sm">
      <div className="form-grid">
        <div><label htmlFor="dn">Database name</label><input id="dn" name="name" required maxLength={120} placeholder="e.g. Haryana manufacturers — finance heads" /></div>
        <div><label htmlFor="ds">Where it came from</label><input id="ds" name="source_label" required maxLength={160} placeholder="e.g. Licensed from XYZ Data Pvt Ltd, Oct 2026" /></div>
        <div><label htmlFor="da">Whose data</label><select id="da" name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}><option value="business">Businesses and their staff (B2B)</option><option value="consumer">Individual consumers</option></select></div>
        <div><label htmlFor="dl">Legal basis</label><select id="dl" name="lawful_basis" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {audience === "business" && <option value="public_business_info">Publicly available business contact information</option>}
          <option value="consent">The people consented to sharing with third parties</option>
          <option value="own_customers">Our own customers / opt-in list</option>
        </select></div>
        <div><label htmlFor="dp">Price per record (credits)</label><input id="dp" name="price" type="number" min="0.1" step="0.1" defaultValue="1" required /></div>
        <div><label htmlFor="df">File (.xlsx or .csv, up to 50 MB)</label><input id="df" name="file" type="file" accept=".xlsx,.csv,text/csv" required /></div>
      </div>
      <div><label htmlFor="dnote">Source details (licence, consent wording, date) — kept on record</label><textarea id="dnote" name="source_note" rows={2} maxLength={1000} /></div>
      <label className="small row" style={{ gap: 8, alignItems: "flex-start" }}>
        <input type="checkbox" name="declared" required style={{ width: "auto", marginTop: 3 }} />
        <span>I confirm this data was obtained lawfully with the basis above — not from a leak, a breach or scraping that the source prohibits — and that people who ask to be removed will be added to the opt-out list. Consumer data is only sold with consent (DPDP Act, 2023).</span>
      </label>
      {msg?.error && <p className="error small">{msg.error}</p>}
      {msg?.note && <p className="small muted">{msg.note}</p>}
      {msg?.message && <p className="success small">{msg.message}</p>}
      {busy && eta && <TimedProgress seconds={eta} label="Uploading and loading the records…" />}
      <div><button aria-busy={!!busy} disabled={busy}>{busy ? "Working…" : "Upload as draft"}</button></div>
    </form>
  );
}
