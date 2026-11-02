"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { pdfPages } from "@/lib/pdftext";
import { readTenderText, formatId } from "@/lib/tenderRules";
import { gemReadFields, gemLines } from "@/lib/gemFields";
import { termLines, termRisks } from "@/lib/bidTerms";
import { aiReadTender } from "@/lib/tenderAi";
import { aiTiers } from "@/lib/ai";
import { aiDocument } from "@/lib/tenderPdf";
import { extractConditions, conditionsFromLines } from "@/lib/conditions";
import { findPrerequisites } from "@/lib/prereq";

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
  if (!["admin", "manager", "bid_preparer"].includes(role)) return { error: "Only admins, managers and bid preparers can read a tender (it uses credits)." };
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, tenders(id, tender_ref, state)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  const { data: files } = await supabase.from("tender_files").select("*").eq("tender_id", m.tender_id).order("created_at");
  if (!files?.some((f) => /\.pdf$/i.test(f.file_name))) return { error: files?.length ? "Only spreadsheets or other files so far — the tender's PDF (NIT) is needed to read it." : "Upload the tender documents (PDF) first." };

  // the same reading a few minutes ago (a retry after a dropped connection, a second click): keep it, charge nothing
  const { data: recent } = await supabase.from("tender_reads").select("id, engine, created_by").eq("tender_id", m.tender_id)
    .gte("created_at", new Date(Date.now() - 3 * 60000).toISOString()).order("created_at", { ascending: false }).limit(5);
  const { data: team } = await supabase.from("tenant_members").select("user_id").eq("tenant_id", tenant.id);
  const ours = new Set((team || []).map((t) => t.user_id));
  if ((recent || []).some((r) => ours.has(r.created_by) && (mode === "basic" || !["rules", "precheck"].includes(r.engine)))) {
    revalidatePath(`/app/tenders/${matchId}`);
    return { message: "This tender was read a few minutes ago — using that reading. No credits used." };
  }

  const price = mode === "ai" ? 99 : 10;
  const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
  if (Number(w?.balance || 0) < price) return { error: `Not enough credits — this needs ${price}.` };
  // one reading at a time: a second click or a retried request waits for the first instead of paying twice
  const lock = { p_company: company.id, p_action: "tender_read", p_ref: m.tender_id };
  const { data: got } = await supabase.rpc("action_lock", { ...lock, p_seconds: 300 });
  if (!got) return { message: "Already reading this tender — the result appears in a moment. No extra credits used." };
  try {
    return await readTenderLocked({ supabase, tenant, company, user, m, matchId, mode, files, price });
  } finally {
    await supabase.rpc("action_unlock", lock);
  }
}

async function readTenderLocked({ supabase, tenant, user, m, matchId, mode, files, price }) {

  // 1. free: extract text and apply rules
  const pages = [], blobs = [];
  let scanned = false, total = 0;
  for (const f of files) {
    if (!/\.pdf$/i.test(f.file_name)) continue; // Excel price schedules and the like are kept, not read
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
  fields.prereq = findPrerequisites(pages); // "Get ready before you file", free
  let engine = "rules", confidence = rules.confidence, note = null, aiFailed = null;

  if (mode === "basic" && scanned && rules.confidence < 40) return { error: "These look like scanned pages, which the free reader cannot read. Use “Read with AI”." };

  // 2. AI only when asked; cheapest engine that succeeds
  if (mode === "ai") {
    if (!aiTiers().length) return { error: "AI reading is not switched on yet (no AI key configured). Use the free reading for now." };
    const doc = await aiDocument(blobs, pages);
    if (doc.error) return { error: doc.error };
    const { pdf = null, text = null } = doc;
    note = doc.note || null;
    const ai = await aiReadTender({ supabase, tenantId: tenant.id, pdf, text });
    if (ai.error) { aiFailed = `AI could not read it (${ai.attempts.join("; ").slice(0, 200)}); the free reading is kept and nothing was charged.`; }
    else {
    const d = ai.data;
    for (const k of ["value_inr", "emd_inr", "req_avg_turnover", "req_similar_one", "req_similar_two", "req_similar_three", "req_similar_years", "bid_validity_days", "performance_security_pct", "turnover_years"]) {
      if (num(d[k]) !== null) fields[k] = num(d[k]);
    }
    for (const k of ["due_at", "prebid_on", "completion_period", "similar_work_definition", "language", "location", "opening_at"]) if (d[k]) fields[k] = d[k];
    if (num(d.tender_fee_inr) !== null) fields.tender_fee_inr = num(d.tender_fee_inr);
    for (const k of ["work_scope", "highlights"]) if (Array.isArray(d[k])) fields[k] = d[k].map(String).slice(0, 12);
    if (typeof d.mse_emd_exempt === "boolean") fields.mse_emd_exempt = d.mse_emd_exempt;
    if (Array.isArray(d.other_eligibility)) fields.other_eligibility = d.other_eligibility.slice(0, 15);
    // the same conditions as plain questions, with the answer that qualifies (shown with outcome buttons)
    if (Array.isArray(d.condition_questions)) fields.condition_questions = d.condition_questions.filter((q) => q && typeof q.condition === "string" && typeof q.question === "string").slice(0, 15).map((q) => ({ condition: q.condition.slice(0, 300), question: q.question.slice(0, 240), qualifies_if: /^no$/i.test(q.qualifies_if) ? "no" : /^yes$/i.test(q.qualifies_if) ? "yes" : null }));
    if (Array.isArray(d.prepare_before)) fields.prepare_before = d.prepare_before.map(String).slice(0, 12);
    if (Array.isArray(d.required_docs) && d.required_docs.length) docs = [...new Set([...docs, ...d.required_docs])];
    if (Array.isArray(d.formats) && d.formats.length) {
      // keep the wording the free reader captured, matched by identifier ("Annexure C") or title
      const idOf = (t) => formatId(t);
      formats = d.formats.slice(0, 40).map((f) => {
        const hit = rules.formats.find((r) => (idOf(r.title) && idOf(r.title) === idOf(f.title)) || r.title.toLowerCase() === String(f.title).toLowerCase());
        return { title: f.title, page: f.page || hit?.page || null, text: hit?.text || "" };
      });
      // no text found by heading: take it from the page the AI named (up to the next format's page, two pages at most)
      formats.forEach((f, i) => {
        if (f.text || !f.page || !pages[f.page - 1]) return;
        const nextPage = formats.slice(i + 1).find((x) => x.page && x.page > f.page)?.page || f.page + 1;
        let text = pages.slice(f.page - 1, Math.min(nextPage - 1, f.page + 1)).join("\n");
        const id = formatId(f.title);
        if (id) { const at = text.split("\n").findIndex((l) => formatId(l.trim()) === id); if (at > 0) text = text.split("\n").slice(at).join("\n"); }
        f.text = text.slice(0, 12000).trim();
      });
    }
    if (Array.isArray(d.risks) && d.risks.length) risks = d.risks.slice(0, 15);
    // a GeM bid's labelled fields are exact: they win over the AI's reading, and their lines lead "Get ready"
    if (fields.gem) {
      // …unless the bid says its attached documents prevail: then the GeM page only fills what the reading left empty
      const g = gemReadFields(fields.gem);
      if (fields.terms?.docs_prevail) { for (const [k, v] of Object.entries(g)) if (fields[k] === undefined || fields[k] === null) fields[k] = v; }
      else Object.assign(fields, g);
      fields.prepare_before = [...gemLines(fields.gem), ...(fields.prepare_before || []).filter((l) => !gemLines(fields.gem).includes(l))].slice(0, 20);
    }
    // the free reader's bid terms (clauses, EMD rules, staff, secrecy…) stay alongside the AI's reading
    if (fields.terms) {
      const tl = termLines(fields.terms, { bidValidityDays: fields.bid_validity_days || null });
      fields.prepare_before = [...(fields.prepare_before || []), ...tl.filter((l) => !(fields.prepare_before || []).includes(l))].slice(0, 24);
      const have = new Set((risks || []).map((r) => r.label));
      risks = [...(risks || []), ...termRisks(fields.terms).filter((r) => !have.has(r.label))].slice(0, 22);
    }
    summary = d.summary.join("\n");
    engine = ai.engine;
    confidence = Math.max(confidence, 85);
    }
  }

  if (!aiFailed) {
    const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: mode === "ai" ? "tender_deep_read" : "tender_read_basic", p_qty: 1, p_ref: m.tenders.tender_ref });
    if (se) return { error: se.message };
  }
  await supabase.from("tender_reads").insert({ tender_id: m.tender_id, engine, confidence, fields: { ...fields, _evidence: rules.evidence, _note: note }, required_docs: docs, formats, risks, summary, created_by: user.id });
  const apply = Object.fromEntries(Object.entries(fields).filter(([k]) => ["value_inr", "emd_inr", "req_avg_turnover", "req_similar_one", "req_similar_two", "req_similar_three", "req_similar_years", "mse_emd_exempt", "prebid_on", "due_at"].includes(k)));
  await supabase.rpc("apply_tender_read", { p_tender: m.tender_id, p_fields: apply, p_docs: docs });
  // yes/no conditions (branch in a state, GST there, ISO, contractor class, years in business) become questions
  const ctx = { state: m.tenders.state };
  const found = extractConditions(pages, ctx);
  const conditions = [...found, ...conditionsFromLines(fields.other_eligibility, ctx, found, fields.condition_questions)];
  await supabase.rpc("set_tender_conditions", { p_tender: m.tender_id, p_conditions: conditions });
  const { data: after } = await supabase.from("tender_matches").select("pending").eq("id", matchId).single();
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath("/app/tenders");
  const asks = after?.pending || 0;
  return { message: `Read by ${engine === "rules" ? "the free reader" : engine}: ${Object.keys(apply).length} criteria, ${conditions.length} conditions, ${docs.length} documents, ${formats.length} formats, ${risks.length} risk clauses. Score updated. ${aiFailed ? aiFailed : `${price} credits used.`}${asks ? ` ${asks} question${asks === 1 ? "" : "s"} for you in the assistant.` : ""}`, asks };
}
