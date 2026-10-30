import "server-only";
import { pdfPages } from "./pdftext";
import { aiDocument } from "./tenderPdf";
import { runJson, aiTiers } from "./ai";
import { companyDrive } from "./drive";
import { downloadFile } from "./google";
import { freeRead, needsAi, docPrompt, cleanExtract, mergeExtract, planApply, applyLines } from "./docRead.js";

const IMAGE = /^image\/(jpeg|png|webp)$/;
const PRICE = 5; // price_book vault_read

async function fileOf(ctx, doc) {
  if (doc.storage_path) {
    const { data, error } = await ctx.supabase.storage.from("vault-docs").download(doc.storage_path);
    if (error) throw new Error(`Could not open the file: ${error.message}`);
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: doc.mime || data.type, name: doc.file_name || "" };
  }
  if (doc.drive_file_id) {
    const { access } = await companyDrive(ctx);
    return await downloadFile(access, doc.drive_file_id);
  }
  return null;
}

const kindOf = (f) => {
  const head = String.fromCharCode(...f.bytes.slice(0, 4));
  if (head === "%PDF" || /pdf/i.test(f.mime || "") || /\.pdf$/i.test(f.name || "")) return "pdf";
  const mime = String(f.mime || "").toLowerCase().replace("image/jpg", "image/jpeg");
  if (IMAGE.test(mime)) return mime;
  if (/\.(jpe?g)$/i.test(f.name || "")) return "image/jpeg";
  if (/\.png$/i.test(f.name || "")) return "image/png";
  return null;
};

// Read one Vault document and fill the masters. Returns { message, lines, conflicts } or { error }.
export async function readVaultDocument(ctx, docId, { allowAi = true } = {}) {
  const { supabase, tenant, company, user } = ctx;
  const { data: doc } = await supabase.from("documents").select("*").eq("id", docId).eq("company_id", company.id).maybeSingle();
  if (!doc) return { error: "Document not found." };
  const done = async (status, extracted, extra = {}) => {
    await supabase.from("documents").update({ read_status: status, read_at: new Date().toISOString(), extracted, ...extra }).eq("id", doc.id);
  };
  let file;
  try { file = await fileOf(ctx, doc); } catch (e) { await done("failed", { error: e.message }); return { error: e.message }; }
  if (!file) { await done("nothing", { note: "No file to read — upload it here (or through Google Drive)." }); return { message: "Saved. Upload the file itself and Dhandha reads it into your Vault." }; }
  const kind = kindOf(file);
  if (!kind) { await done("nothing", { note: "Only PDF and photos (JPG / PNG) are read for now." }); return { message: "Saved. Only PDFs and photos are read for now." }; }

  // 1. free: the text of a typed PDF and the patterns for its type
  let pages = [], chars = 0;
  if (kind === "pdf") { try { const t = await pdfPages(file.bytes); pages = t.pages; chars = t.chars; } catch { /* scanned or damaged: AI only */ } }
  const free = freeRead(doc.type_code, pages.join("\n"));
  let ex = cleanExtract(free), engine = "free reader", ai = null;

  // 2. AI only where the free reader cannot do it — paid tiers only (the firm's private data)
  if (needsAi(doc.type_code, free, chars) && allowAi) {
    if (!aiTiers().some((t) => !t.free)) {
      ex.note = "AI reading is not switched on, so only typed details were read.";
    } else {
      const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle();
      if (Number(w?.balance || 0) < PRICE) ex.note = `AI reading needs ${PRICE} credits — top up and press "Read again".`;
      else {
        const lock = { p_company: company.id, p_action: "vault_read", p_ref: doc.id };
        const { data: got } = await supabase.rpc("action_lock", { ...lock, p_seconds: 240 });
        if (!got) return { message: "Already reading this document — the result appears in a moment." };
        try {
          await supabase.from("documents").update({ read_status: "reading" }).eq("id", doc.id);
          const { data: dt } = await supabase.from("document_types").select("name").eq("code", doc.type_code).maybeSingle();
          const input = kind === "pdf" ? await aiDocument([file.bytes], pages) : { image: { bytes: file.bytes, mime: kind } };
          if (input.error) ex.note = input.error;
          else {
            ai = await runJson({ supabase, tenantId: tenant.id, task: "vault_read", prompt: docPrompt(doc.type_code, dt?.name), ...input, private: true, maxTokens: 4000, budgetMs: 200000,
              validate: (d) => (d && typeof d === "object" && (d.company || d.facts || d.people || d.document) ? null : "no fields") });
            if (ai.error) ex.note = "AI could not read this document; typed details only.";
            else {
              await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "vault_read", p_qty: 1, p_ref: (doc.title || doc.type_code).slice(0, 60) });
              ex = { ...mergeExtract(cleanExtract(free), cleanExtract(ai.data)), note: ex.note };
              engine = ai.label;
            }
          }
        } finally { await supabase.rpc("action_unlock", lock); }
      }
    }
  }

  // 3. into the masters: fill what is empty, list what differs
  const [{ data: c }, { data: facts }, { data: people }, { data: works }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", company.id).single(),
    supabase.from("company_facts").select("key, period, value").eq("company_id", company.id),
    supabase.from("people").select("id, name, designation, din, pan, share_pct, qualification, membership_no").eq("company_id", company.id),
    supabase.from("experience_items").select("client, work_name").eq("company_id", company.id),
  ]);
  const plan = planApply(ex, { company: c, facts, people, works });
  const errors = [];
  if (Object.keys(plan.company).length) { const { error } = await supabase.from("companies").update(plan.company).eq("id", company.id); if (error) errors.push(error.message); }
  if (plan.facts.length) {
    const { error } = await supabase.from("company_facts").upsert(plan.facts.map((f) => ({ tenant_id: tenant.id, company_id: company.id, key: f.key, period: f.period || "", value: String(f.value), unit: f.key.startsWith("fin.") ? "INR" : "persons", source: "document" })), { onConflict: "company_id,key,period" });
    if (error) errors.push(error.message);
  }
  for (const p of plan.peopleAdd) {
    const { error } = await supabase.from("people").insert({ tenant_id: tenant.id, company_id: company.id, name: p.name, designation: p.designation, din: p.din, pan: p.pan, share_pct: p.share_pct, qualification: p.qualification, membership_no: p.membership_no, source: "document" });
    if (error) errors.push(error.message);
  }
  for (const p of plan.peopleUpdate) await supabase.from("people").update(p.set).eq("id", p.id).eq("company_id", company.id);
  for (const w of plan.worksAdd) {
    const { error } = await supabase.from("experience_items").insert({ tenant_id: tenant.id, company_id: company.id, client: w.client, work_name: w.work_name, value_inr: w.value_inr, start_date: w.start_date, end_date: w.end_date, status: w.status, category: "From documents" });
    if (error) errors.push(error.message);
  }
  // the document's own details, where the person left them blank
  const own = {};
  for (const k of ["title", "number", "period", "issued_on", "valid_until"]) if (ex.document?.[k] && !doc[k]) own[k] = ex.document[k];
  const lines = applyLines(plan);
  await done(lines.length || plan.conflicts.length ? "done" : "partial", { engine, at: new Date().toISOString(), lines, conflicts: plan.conflicts, summary: ex.summary || [], note: ex.note || null, errors, by: user.id }, own);
  if (plan.count) await supabase.rpc("rescore_company", { p_company: company.id });
  const msg = lines.length ? `Read by the ${engine}: ${lines.length} detail${lines.length === 1 ? "" : "s"} added to your Vault.` : "Read — nothing new for your Vault.";
  return { message: `${msg}${plan.conflicts.length ? ` ${plan.conflicts.length} differ from what you had — check them below.` : ""}${ex.note ? ` ${ex.note}` : ""}`, lines, conflicts: plan.conflicts };
}
