"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { performanceSecurity, awardTasks, experienceFromWin } from "@/lib/afterAward";

const canEdit = (role) => ["admin", "manager", "bid_preparer"].includes(role);
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null);
const money = (v) => { const n = Number(String(v || "").replace(/[,₹\s]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };

// The LoA / work order of a won tender → the follow-up tasks (performance security, agreement, kick-off), each once
export async function saveAward(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (!canEdit(role)) return { error: "Only admins, managers and bid preparers can do this." };
  const matchId = String(formData.get("match_id") || "");
  const { data: m } = await supabase.from("tender_matches").select("id, status, loa_date, quoted_price, tender_id, tenders(title, value_inr)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m) return { error: "Tender not found." };
  if (m.status !== "won") return { error: "Mark the tender as won first." };
  const upd = { loa_no: String(formData.get("loa_no") || "").trim().slice(0, 120) || null, loa_date: day(formData.get("loa_date")), contract_value: money(formData.get("contract_value")),
    work_start: day(formData.get("work_start")), work_end: day(formData.get("work_end")) };
  if (!upd.loa_date) return { error: "The date of the LoA / work order is needed — the deadlines count from it." };
  const { error } = await supabase.from("tender_matches").update(upd).eq("id", matchId).eq("company_id", company.id);
  if (error) return { error: error.message };
  let made = 0;
  if (!m.loa_date) { // tasks only the first time the LoA is recorded
    const { data: rd } = await supabase.from("tender_reads").select("fields").eq("tender_id", m.tender_id).order("created_at", { ascending: false }).limit(1);
    const f = rd?.[0]?.fields || {};
    const ps = performanceSecurity({ pct: f.performance_security_pct, epbgPct: f.gem?.epbg_pct, months: f.gem?.epbg_months, value: upd.contract_value || m.quoted_price || m.tenders?.value_inr, loaDate: upd.loa_date });
    const rows = awardTasks({ title: m.tenders?.title, loaDate: upd.loa_date, ps }).map((t) => ({
      tenant_id: tenant.id, company_id: company.id, title: t.title.slice(0, 200), due_at: `${t.due}T12:00:00+05:30`, priority: t.priority, status: "todo",
      link_type: "tender", link_id: matchId, link_label: (m.tenders?.title || "").slice(0, 120), created_by: user.id, assigned_to: user.id,
      details: t.key === "ps" ? `Performance security ${ps.pct}% of the contract value${ps.months ? `, valid ${ps.months} months` : ""}. Record it under EMD & deposits when given.` : null,
    }));
    if (rows.length) { const { error: te } = await supabase.from("tasks").insert(rows); if (!te) made = rows.length; }
  }
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath("/app/tasks");
  return { message: `Saved.${made ? ` ${made} tasks added with their due dates (performance security, agreement, kick-off) — see Tasks.` : ""}` };
}

// The work is finished: it goes into Vault → Experience (so the next tender's similar-work test counts it)
export async function completeWork(prev, formData) {
  const { supabase, tenant, company, role, user } = await getContext();
  if (!canEdit(role)) return { error: "Only admins, managers and bid preparers can do this." };
  const matchId = String(formData.get("match_id") || "");
  const completed_on = day(formData.get("completed_on"));
  if (!completed_on) return { error: "Pick the date the work was completed." };
  const { data: m } = await supabase.from("tender_matches").select("id, status, experience_id, loa_no, loa_date, contract_value, quoted_price, work_start, work_end, tenders(title, authority, department, value_inr)").eq("id", matchId).eq("company_id", company.id).maybeSingle();
  if (!m || m.status !== "won") return { error: "Only a won tender can be completed." };
  if (m.experience_id) return { error: "Already added to your Experience." };
  const row = experienceFromWin({ tender: m.tenders, match: { ...m, completed_on } });
  const { data: e, error } = await supabase.from("experience_items").insert({ tenant_id: tenant.id, company_id: company.id, ...row }).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("tender_matches").update({ completed_on, experience_id: e.id }).eq("id", matchId).eq("company_id", company.id);
  await supabase.from("tasks").insert({ tenant_id: tenant.id, company_id: company.id, title: `Ask for the completion certificate — ${String(m.tenders?.title || "").slice(0, 120)}`, due_at: new Date(Date.now() + 7 * 864e5).toISOString(),
    priority: "high", status: "todo", link_type: "tender", link_id: matchId, created_by: user.id, assigned_to: user.id, details: "The request letter is ready on the tender page (After the award). Upload the certificate to Vault → Documents when it comes." });
  await supabase.rpc("rescore_company", { p_company: company.id });
  revalidatePath(`/app/tenders/${matchId}`);
  revalidatePath("/app/vault/experience");
  return { message: "Added to Vault → Experience — every similar-works test now counts it. A task to ask for the completion certificate was added; the letter is below." };
}
