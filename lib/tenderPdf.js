import "server-only";
import { PDFDocument } from "pdf-lib";
import { pdfPages } from "./pdftext.js";

// What to send the AI for a tender's PDFs. The whole document when it fits (≤ 18 MB, ≤ 100 pages); otherwise the
// extracted text when there is real text; for big scanned documents (little text) the first pages as a PDF, so the
// AI sees the pages instead of an almost empty text.
const MAX_BYTES = 18 * 1024 * 1024, MAX_PAGES = 100;
async function mergePages(blobs, limit) {
  const merged = await PDFDocument.create();
  for (const b of blobs) {
    if (merged.getPageCount() >= limit) break;
    try {
      const src = await PDFDocument.load(b, { ignoreEncryption: true });
      const idx = src.getPageIndices().slice(0, limit - merged.getPageCount());
      (await merged.copyPages(src, idx)).forEach((p) => merged.addPage(p));
    } catch {}
  }
  return merged.getPageCount() ? { bytes: await merged.save(), pages: merged.getPageCount() } : null;
}
export async function aiDocument(blobs, pageTexts = []) {
  if (!blobs.length) return { error: "The tender's PDF is not in yet." };
  const total = blobs.reduce((s, b) => s + b.length, 0);
  const chars = pageTexts.reduce((s, p) => s + p.length, 0);
  if (total <= MAX_BYTES && (pageTexts.length || 0) <= MAX_PAGES) {
    if (blobs.length === 1) return { pdf: blobs[0] };
    const m = await mergePages(blobs, MAX_PAGES);
    if (m && m.bytes.length <= MAX_BYTES) return { pdf: m.bytes };
  }
  if (chars >= 20000 && chars / Math.max(1, pageTexts.length) >= 300) {
    return { text: pageTexts.map((p, i) => `--- page ${i + 1} ---\n${p}`).join("\n").slice(0, 150000), note: "Document too large to send whole; AI read the extracted text." };
  }
  for (let limit = MAX_PAGES; limit >= 10; limit = Math.floor(limit / 2)) {
    const m = await mergePages(blobs, limit);
    if (m && m.bytes.length <= MAX_BYTES) return { pdf: m.bytes, note: `Large scanned document: AI read the first ${m.pages} pages.` };
  }
  return { text: pageTexts.join("\n").slice(0, 150000), note: "Document too large; AI read the extracted text." };
}

// A tender's PDFs for an AI call, loaded from Storage.
export async function tenderPdfFor(supabase, tenderId) {
  const { data: files } = await supabase.from("tender_files").select("storage_path, file_name").eq("tender_id", tenderId).order("created_at");
  const blobs = [], pages = [];
  for (const f of files || []) {
    if (!/\.pdf$/i.test(f.file_name)) continue;
    const { data } = await supabase.storage.from("tender-docs").download(f.storage_path);
    if (!data) continue;
    const b = new Uint8Array(await data.arrayBuffer());
    blobs.push(b);
    try { pages.push(...(await pdfPages(b)).pages); } catch {}
  }
  return aiDocument(blobs, pages);
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
