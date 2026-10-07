"use server";
import { revalidatePath } from "next/cache";
import { PDFDocument } from "pdf-lib";
import { getContext } from "@/lib/session";
import { pdfPages } from "@/lib/pdftext";
import { readTenderText } from "@/lib/tenderRules";
import { aiReadTender } from "@/lib/tenderAi";
import { aiTiers } from "@/lib/ai";

export async function recordTenderFile({ tenderId, path, name, size }) {
  const { supabase, user } = await getContext();
  if (!String(path).startsWith(`${tenderId}/`)) return { error: "Invalid path." };
  const { error } = await supabase.from("tender_files").insert({ tender_id: tenderId, storage_path: path, file_name: name.slice(0, 200), size_bytes: size, uploaded_by: user.id });
  if (error) return { error: error.message };
  return { ok: true };
}

const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export async function readTender(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  const matchId = String(formData.get("match_id"));
  const mode = formData.get("mode") === "ai" ? "ai" : "basic";
  if (role === "viewer") return { error: "Viewers cannot run tender reading." };
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, tenders(id, tender_ref)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  const { data: files } = await supabase.from("tender_files").select("*").eq("tender_id", m.tender_id).order("created_at");
  if (!files?.length) return { error: "Upload the tender documents (PDF) first." };

  const price = mode === "ai" ? 99 : 10;
  const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
  if (Number(w?.balance || 0) < price) return { error: `Not enough credits — this needs ${price}.` };

  // 1. free: extract text and apply rules
  const pages = [], blobs = [];
  let scanned = false, total = 0;
  for (const f of files) {
    const { data, error } = await supabase.storage.from("tender-docs").download(f.storage_path);
    if (error) continue;
    const bytes = new Uint8Array(await data.arrayBuffer());
    total += bytes.length;
    blobs.push(bytes);
    try {
      const t = await pdfPages(bytes);
      pages.push(...t.pages);
      scanned = scanned || t.scanned;
      await supabase.from("tender_files").update({ pages: t.pageCount, text_chars: t.chars, scanned: t.scanned }).eq("id", f.id);
    } catch { scanned = true; }
  }
  const rules = readTenderText(pages);
  let fields = { ...rules.fields }, docs = rules.required_docs, formats = rules.formats, risks = rules.risks, summary = null;
  let engine = "rules", confidence = rules.confidence, note = null;

  if (mode === "basic" && scanned && rules.confidence < 40) return { error: "These look like scanned pages, which the free reader cannot read. Use “Read with AI”." };

  // 2. AI only when asked; cheapest engine that succeeds
  if (mode === "ai") {
    if (!aiTiers().length) return { error: "AI reading is not switched on yet (no AI key configured). Use the free reading for now." };
    let pdf = null, text = null;
    if (total <= 18 * 1024 * 1024 && pages.length <= 100) {
      if (blobs.length === 1) pdf = blobs[0];
      else {
        const merged = await PDFDocument.create();
        for (const b of blobs) { try { const src = await PDFDocument.load(b, { ignoreEncryption: true }); (await merged.copyPages(src, src.getPageIndices())).forEach((p) => merged.addPage(p)); } catch {} }
        pdf = await merged.save();
      }
    } else {
      text = pages.map((p, i) => `--- page ${i + 1} ---\n${p}`).join("\n").slice(0, 150000);
      note = "Document too large to send whole; AI read the extracted text.";
    }
    const ai = await aiReadTender({ supabase, tenantId: tenant.id, pdf, text });
    if (ai.error) return { error: `${ai.error} Free reading result kept. (${ai.attempts.join("; ").slice(0, 300)})` };
    const d = ai.data;
    for (const k of ["value_inr", "emd_inr", "req_avg_turnover", "req_similar_one", "req_similar_two", "req_similar_three", "req_similar_years", "bid_validity_days", "performance_security_pct", "turnover_years"]) {
      if (num(d[k]) !== null) fields[k] = num(d[k]);
    }
    for (const k of ["due_at", "prebid_on", "completion_period", "similar_work_definition", "language"]) if (d[k]) fields[k] = d[k];
    if (typeof d.mse_emd_exempt === "boolean") fields.mse_emd_exempt = d.mse_emd_exempt;
    if (Array.isArray(d.other_eligibility)) fields.other_eligibility = d.other_eligibility.slice(0, 15);
    if (Array.isArray(d.required_docs) && d.required_docs.length) docs = [...new Set([...docs, ...d.required_docs])];
    if (Array.isArray(d.formats) && d.formats.length) {
      // keep the wording the free reader captured, matched by identifier ("Annexure C") or title
      const idOf = (t) => (String(t).match(/^(annexure|annex|appendix|form|format|schedule|proforma)\s*[-.]?\s*([A-Z0-9IVX]{1,5})\b/i) || []).slice(1).join(" ").toLowerCase();
      formats = d.formats.slice(0, 40).map((f) => {
        const hit = rules.formats.find((r) => (idOf(r.title) && idOf(r.title) === idOf(f.title)) || r.title.toLowerCase() === String(f.title).toLowerCase());
        return { title: f.title, page: f.page || hit?.page || null, text: hit?.text || "" };
      });
    }
    if (Array.isArray(d.risks) && d.risks.length) risks = d.risks.slice(0, 15);
    summary = d.summary.join("\n");
    engine = ai.engine;
    confidence = Math.max(confidence, 85);
  }

  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: mode === "ai" ? "tender_deep_read" : "tender_read_basic", p_qty: 1, p_ref: m.tenders.tender_ref });
  if (se) return { error: se.message };
  await supabase.from("tender_reads").insert({ tender_id: m.tender_id, engine, confidence, fields: { ...fields, _evidence: rules.evidence, _note: note }, required_docs: docs, formats, risks, summary, created_by: user.id });
  const apply = Object.fromEntries(Object.entries(fields).filter(([k]) => ["value_inr", "emd_inr", "req_avg_turnover", "req_similar_one", "req_similar_two", "req_similar_three", "req_similar_years", "mse_emd_exempt", "prebid_on", "due_at"].includes(k)));
  await supabase.rpc("apply_tender_read", { p_tender: m.tender_id, p_fields: apply, p_docs: docs });
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath("/app/tenders");
  const found = Object.keys(apply).length;
  return { message: `Read by ${engine === "rules" ? "the free reader" : engine}: ${found} criteria, ${docs.length} documents, ${formats.length} formats, ${risks.length} risk clauses. Score updated. ${price} credits used.` };
}
