import "server-only";
import { PDFDocument } from "pdf-lib";
import { pdfPages } from "./pdftext";

// A tender's PDFs for an AI call: one merged PDF when small enough, otherwise the extracted text.
export async function tenderPdfFor(supabase, tenderId) {
  const { data: files } = await supabase.from("tender_files").select("storage_path, file_name").eq("tender_id", tenderId).order("created_at");
  const blobs = [];
  for (const f of files || []) {
    if (!/\.pdf$/i.test(f.file_name)) continue;
    const { data } = await supabase.storage.from("tender-docs").download(f.storage_path);
    if (data) blobs.push(new Uint8Array(await data.arrayBuffer()));
  }
  if (!blobs.length) return { error: "The tender's PDF is not in yet." };
  const total = blobs.reduce((s, b) => s + b.length, 0);
  if (total <= 18 * 1024 * 1024) {
    if (blobs.length === 1) return { pdf: blobs[0] };
    const merged = await PDFDocument.create();
    for (const b of blobs) { try { const src = await PDFDocument.load(b, { ignoreEncryption: true }); (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p)); } catch {} }
    if (merged.getPageCount() <= 100) return { pdf: await merged.save() };
  }
  const pages = [];
  for (const b of blobs) { try { pages.push(...(await pdfPages(b)).pages); } catch {} }
  return { text: pages.map((p, i) => `--- page ${i + 1} ---\n${p}`).join("\n").slice(0, 150000) };
}

// What the Vault says about the bidder, for AI calls that need it (paid engines only).
export async function vaultFor(supabase, companyId) {
  const [{ data: c }, { data: facts }, { data: works }, { data: people }, { data: docs }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase.from("company_facts").select("key, period, value, unit").eq("company_id", companyId),
    supabase.from("experience_items").select("work_name, client, category, value_inr, start_date, end_date, status").eq("company_id", companyId).limit(25),
    supabase.from("people").select("name, designation, qualification, years_experience, membership_no").eq("company_id", companyId).limit(25),
    supabase.from("documents").select("type_code, valid_until").eq("company_id", companyId).eq("status", "active"),
  ]);
  return {
    company: Object.fromEntries(Object.entries(c || {}).filter(([k, v]) => v && !["id", "tenant_id", "created_at", "updated_at", "bank_account", "pan"].includes(k))),
    facts: (facts || []).map((f) => ({ key: f.key, period: f.period || undefined, value: f.value, unit: f.unit || undefined })),
    works: works || [], people: people || [], documents_held: (docs || []).map((d) => d.type_code + (d.valid_until ? ` (valid till ${d.valid_until})` : "")),
  };
}
