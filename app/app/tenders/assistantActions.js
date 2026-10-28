"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { runJson, aiTiers } from "@/lib/ai";
import { tenderPdfFor, vaultFor } from "@/lib/tenderPdf";
import { normaliseEval } from "@/lib/evaluation";
import { buildSegments, composeText } from "@/lib/annexure";
import { labelKey, partnerLabel } from "@/lib/masters";

// The tender assistant's own actions: filing despite an unmet mandatory condition, technical marking, questions
// to the assistant (Claude), and annexures edited as forms.

const done = (matchId) => { revalidatePath(`/app/tenders/${matchId}/assistant`); revalidatePath(`/app/tenders/${matchId}`); revalidatePath("/app/tenders"); };
const preparer = (role) => ["admin", "manager", "bid_preparer"].includes(role);
async function enough(supabase, tenantId, credits) {
  const { data: w } = await supabase.from("wallets").select("balance").eq("tenant_id", tenantId).maybeSingle();
  return Number(w?.balance || 0) >= credits;
}
const PAID = "Paid AI is not switched on for this site (your company data never goes to free AI).";

// 1. A mandatory condition is not met and the person decides to file anyway: recorded with who and when.
export async function forceFiling({ matchId, note }) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers can decide this." };
  const { error } = await supabase.from("tender_matches").update({ forced_at: new Date().toISOString(), forced_by: user.id, forced_note: String(note || "").slice(0, 500) || null })
    .eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  await supabase.from("audit_log").insert({ tenant_id: tenant.id, company_id: company.id, action: "file_anyway", entity: "tender_match", detail: { match: matchId, note: String(note || "").slice(0, 500) } }).then(() => {}, () => {});
  done(matchId);
  return { ok: true };
}

// 3. Technical marking: the tender's evaluation method and criteria, with the marks the Vault supports.
const EVAL_PROMPT = (vault) => `You help an Indian bidder understand how this tender will be evaluated.
From the tender document, find the evaluation method and the technical marking criteria. Then mark the bidder below against each criterion using ONLY the bidder data.
Return ONE JSON object:
{"method": "L1" | "QCBS" | "QBS" | "other", "tech_weight": number (percent, QCBS only), "fin_weight": number (percent, QCBS only),
 "min_tech_score": number or null (minimum technical marks to qualify), "formula": string (the tender's own words on how scores combine, short),
 "criteria": [{"criterion": string, "max_marks": number, "scoring": how the tender gives marks (short), "awarded": number or null, "basis": which bidder data gives these marks (short), "raise": what would earn more marks (short, or "")}]}
If the tender has no technical marking (lowest price among qualified bids wins), use "method": "L1" and "criteria": [].
"awarded" is null only where the marks depend on something not in the data (a presentation, a site visit). Never invent bidder data.
Bidder data (JSON): ${JSON.stringify(vault)}`;

export async function techMarking({ matchId }) {
  const { supabase, tenant, company, role } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers can do this." };
  if (!aiTiers().some((t) => !t.free)) return { error: PAID };
  if (!(await enough(supabase, tenant.id, 29))) return { error: "Not enough credits — this needs 29." };
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, tenders(tender_ref)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m?.tenders) return { error: "Tender not found." };
  const doc = await tenderPdfFor(supabase, m.tender_id);
  if (doc.error) return doc;
  const ai = await runJson({ supabase, tenantId: tenant.id, task: "tech_marking", prompt: EVAL_PROMPT(await vaultFor(supabase, company.id)), pdf: doc.pdf, text: doc.text, private: true, maxTokens: 5000,
    validate: (d) => (!d.method ? "no method" : !Array.isArray(d.criteria) ? "no criteria list" : null) });
  if (ai.error) return { error: ai.error };
  const ev = { ...normaliseEval(ai.data), engine: ai.engine, at: new Date().toISOString() };
  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "tech_marking", p_qty: 1, p_ref: m.tenders.tender_ref });
  if (se) return { error: se.message };
  await supabase.from("tender_matches").update({ tech_eval: ev }).eq("id", matchId);
  done(matchId);
  return { ok: true, message: ev.method === "L1" ? "This is an L1 tender: after qualifying, the lowest price wins. I'll show you the best price at the price step." : `Evaluation: ${ev.method}${ev.tech_weight ? ` (technical ${ev.tech_weight}% : financial ${ev.fin_weight}%)` : ""}. Your technical marks are below; the final weighted score is worked out at the price step.` };
}

// 2. Ask anything about the tender or the current question. Answered by Claude from the documents and the Vault.
export async function askAssistant({ matchId, question, about, history = [] }) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot ask the assistant." };
  const q = String(question || "").trim().slice(0, 1500);
  if (!q) return { error: "Type your question." };
  if (!aiTiers().some((t) => !t.free)) return { error: PAID };
  if (!(await enough(supabase, tenant.id, 3))) return { error: "Not enough credits — a question needs 3." };
  const { data: m } = await supabase.from("tender_matches").select("id, tender_id, score, eligible, reasons, quoted_price, tech_eval, tenders(*)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m?.tenders) return { error: "Tender not found." };
  const [{ data: reads }, doc, vault] = await Promise.all([
    supabase.from("tender_reads").select("fields, summary, risks, formats").eq("tender_id", m.tender_id).order("created_at", { ascending: false }).limit(1),
    tenderPdfFor(supabase, m.tender_id),
    vaultFor(supabase, company.id),
  ]);
  const t = m.tenders, read = reads?.[0];
  const context = {
    tender: { title: t.title, ref: t.tender_ref, authority: t.authority, portal: t.portal, value_inr: t.value_inr, emd_inr: t.emd_inr, due_at: t.due_at },
    brief: read ? { summary: read.summary, fields: Object.fromEntries(Object.entries(read.fields || {}).filter(([k]) => !k.startsWith("_"))), risks: read.risks, formats: (read.formats || []).map((f) => f.title) } : null,
    eligibility: { score: m.score, eligible: m.eligible, reasons: m.reasons }, evaluation: m.tech_eval || null, quoted_price: m.quoted_price, bidder: vault,
  };
  const prompt = `You are the tender assistant inside Dhandha, helping an Indian bidder prepare this tender. Answer the bidder's question clearly and briefly (under 150 words unless they ask for detail), in the language they write in.
Use the tender document (cite page numbers where you can), the context and the bidder data below. If the documents do not say, say so plainly and suggest what to check or ask in the pre-bid meeting. Do not invent clauses, numbers or bidder data. Give practical advice where it helps.
${about ? `The assistant had just asked the bidder: "${String(about).slice(0, 500)}"\n` : ""}Context (JSON): ${JSON.stringify(context).slice(0, 30000)}
Earlier in this chat: ${JSON.stringify(history.slice(-6).map((h) => ({ who: h.who, text: String(h.text).slice(0, 600) })))}
Bidder's question: ${q}
Return JSON: {"answer": string}`;
  const ai = await runJson({ supabase, tenantId: tenant.id, task: "assistant_chat", prompt, pdf: doc.pdf, text: doc.text, private: true, maxTokens: 1200, validate: (d) => (!d.answer ? "no answer" : null) });
  if (ai.error) return { error: ai.error };
  const { error: se } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "assistant_chat", p_qty: 1, p_ref: t.tender_ref });
  if (se) return { error: `Could not charge the 3 credits, so the answer is not shown: ${se.message}` };
  return { answer: String(ai.data.answer).slice(0, 4000) };
}

// 4. An annexure edited as a form: the text is stored for the bid file; typed answers and new table rows are
// saved to the masters (facts, Key people, Experience) so the next tender has them.
export async function saveAnnexure({ matchId, idx, segments }) {
  const { supabase, tenant, company, role } = await getContext();
  if (!preparer(role)) return { error: "Only admins, managers and bid preparers can edit the formats." };
  const { data: m } = await supabase.from("tender_matches").select("id, filled_formats").eq("id", matchId).eq("company_id", company.id).single();
  const plan = m?.filled_formats || [];
  const p = plan[idx];
  if (!p || !["custom", "manual"].includes(p.kind)) return { error: "That format cannot be edited here." };
  if (!Array.isArray(segments) || segments.length > 400) return { error: "Something went wrong with the form." };
  const segs = segments.map((s) => s.t === "text" ? { t: "text", v: String(s.v ?? "").slice(0, 20000) }
    : s.t === "field" ? { t: "field", kind: s.kind === "partner" ? "partner" : "fact", n: Number(s.n) || null, field: String(s.field || ""), label: String(s.label || "").slice(0, 120), value: String(s.value ?? "").slice(0, 2000), personId: s.personId || null }
    : { t: "table", kind: ["people", "works"].includes(s.kind) ? s.kind : "other", cols: (s.cols || []).map((c) => String(c).slice(0, 60)).slice(0, 10), rows: (s.rows || []).slice(0, 200).map((r) => (r || []).map((c) => String(c ?? "").slice(0, 300))), newRows: (s.newRows || []).slice(0, 200).map(Number), save: !!s.save });

  // answers to the masters
  const facts = [];
  for (const s of segs.filter((x) => x.t === "field" && x.value.trim())) {
    if (s.kind === "partner" && s.personId && ["name", "designation", "qualification", "years_experience", "membership_no", "pan"].includes(s.field)) {
      await supabase.from("people").update({ [s.field]: s.field === "years_experience" ? Number(s.value) || null : s.field === "pan" ? s.value.trim().toUpperCase().slice(0, 10) : s.value.trim().slice(0, 120) }).eq("id", s.personId).eq("company_id", company.id);
    } else {
      const key = labelKey(s.kind === "partner" ? partnerLabel({ label: s.label, n: s.n }) : s.label);
      if (/^master\.[a-z0-9_]{1,60}$/.test(key)) facts.push({ tenant_id: tenant.id, company_id: company.id, key, period: "", value: s.value.trim(), source: "tender assistant" });
    }
  }
  if (facts.length) await supabase.from("company_facts").upsert(facts, { onConflict: "company_id,key,period" });
  // new table rows to Key people / Experience
  let added = 0;
  for (const s of segs.filter((x) => x.t === "table" && x.save && x.newRows.length)) {
    const fresh = s.newRows.map((i) => s.rows[i]).filter((r) => r && r[0]?.trim());
    if (s.kind === "people" && fresh.length) {
      const { error } = await supabase.from("people").insert(fresh.map((r) => ({ tenant_id: tenant.id, company_id: company.id, name: r[0].trim(), designation: r[1] || null, qualification: r[2] || null, membership_no: r[3] || null, years_experience: Number(r[4]) || null })));
      if (!error) added += fresh.length;
    }
    if (s.kind === "works" && fresh.length) {
      const { error } = await supabase.from("experience_items").insert(fresh.map((r) => ({ tenant_id: tenant.id, company_id: company.id, work_name: r[0].trim(), client: r[1] || "—", value_inr: Number(String(r[2]).replace(/[^\d.]/g, "")) || null, end_date: /^\d{4}-\d{2}-\d{2}$/.test(r[3]) ? r[3] : null, status: "completed" })));
      if (!error) added += fresh.length;
    }
  }
  plan[idx] = { ...p, edited_text: composeText(segs), reviewed: true };
  const { error } = await supabase.from("tender_matches").update({ filled_formats: plan }).eq("id", matchId);
  if (error) return { error: error.message };
  done(matchId);
  return { ok: true, message: `Saved “${p.title}”.${facts.length ? ` ${facts.length} answer${facts.length === 1 ? "" : "s"} kept in your masters.` : ""}${added ? ` ${added} new row${added === 1 ? "" : "s"} added to your Vault.` : ""}` };
}

// The form for one annexure, rebuilt from what is stored (used when the person opens it again).
export async function annexureSegments({ matchId, idx }) {
  const { supabase, company } = await getContext();
  const [{ data: m }, { data: facts }, { data: people }, { data: works }] = await Promise.all([
    supabase.from("tender_matches").select("filled_formats").eq("id", matchId).eq("company_id", company.id).single(),
    supabase.from("company_facts").select("key, period, value").eq("company_id", company.id),
    supabase.from("people").select("*").eq("company_id", company.id).order("created_at"),
    supabase.from("experience_items").select("*").eq("company_id", company.id),
  ]);
  const p = m?.filled_formats?.[idx];
  if (!p) return { error: "Format not found." };
  return { title: p.title, segments: buildSegments(p.edited_text || p.filled_text || p.text || "", { facts: facts || [], people: people || [], works: works || [] }) };
}

// The chat is kept per tender, so questions and answers stay on screen when the page is opened again.
export async function saveChat({ matchId, entries }) {
  const { supabase, tenant, role } = await getContext();
  if (role === "viewer" || !Array.isArray(entries) || !entries.length) return { ok: false };
  const rows = entries.slice(0, 10).map((e) => ({ tenant_id: tenant.id, match_id: matchId, who: e.who === "me" ? "me" : "bot", body: String(e.text || "").slice(0, 4000), error: !!e.error })).filter((r) => r.body);
  const { error } = await supabase.from("tender_chat").insert(rows);
  return error ? { error: error.message } : { ok: true };
}
