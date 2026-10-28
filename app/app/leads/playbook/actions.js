"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { normalisePlaybook, STARTER } from "@/lib/playbook";

const isLead = (role) => ["admin", "manager"].includes(role);
const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

// New playbook: the starter (call → WhatsApp → email → booking link → task) or an empty one, then open the builder.
export async function createPlaybook(formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!isLead(role)) return;
  const starter = formData.get("from") === "starter";
  const { data, error } = await supabase.from("sequences").insert({
    tenant_id: tenant.id, company_id: company.id, name: starter ? STARTER.name : "New playbook", active: false,
    trigger: "manual", office_from: STARTER.office_from, office_to: STARTER.office_to, office_days: STARTER.office_days,
  }).select("id").single();
  if (error) return;
  redirect(`/app/leads/playbook/${data.id}${starter ? "?starter=1" : ""}`);
}

// The builder saves the whole playbook at once: its settings, then its steps in the order shown.
export async function savePlaybook(id, raw) {
  const { supabase, company, role } = await getContext();
  if (!isLead(role)) return { error: "Only admins and managers can change playbooks." };
  const r = normalisePlaybook(raw);
  if (r.error) return r;
  if (r.playbook.trigger === "new_lead" && r.playbook.active) {
    // one automatic playbook per source: a lead must not start two at once
    const { data: others } = await supabase.from("sequences").select("id, name, trigger_sources").eq("company_id", company.id).eq("trigger", "new_lead").eq("active", true).neq("id", id);
    const mine = r.playbook.trigger_sources;
    const clash = (others || []).find((o) => !mine || !o.trigger_sources?.length || o.trigger_sources.some((s) => mine.includes(s)));
    if (clash) return { error: `“${clash.name}” already starts on new leads from the same source. Switch it off or choose other sources.` };
  }
  const { error: e1 } = await supabase.from("sequences").update(r.playbook).eq("id", id).eq("company_id", company.id);
  if (e1) return { error: msg(e1) };
  // steps are replaced in the new order; leads already part-way carry on from their step number
  const { error: e2 } = await supabase.from("sequence_steps").delete().eq("sequence_id", id);
  if (e2) return { error: msg(e2) };
  const { error: e3 } = await supabase.from("sequence_steps").insert(r.steps.map((s) => ({ ...s, sequence_id: id })));
  if (e3) return { error: msg(e3) };
  revalidatePath("/app/leads/playbook");
  revalidatePath(`/app/leads/playbook/${id}`);
  return { ok: true };
}

export async function setPlaybookActive(formData) {
  const { supabase, company, role } = await getContext();
  if (!isLead(role)) return;
  await supabase.from("sequences").update({ active: formData.get("active") === "1" }).eq("id", String(formData.get("id"))).eq("company_id", company.id);
  revalidatePath("/app/leads/playbook");
}

// Put chosen leads through a playbook by hand (the same as starting a sequence).
export async function startForLeads(id, leadIds) {
  const { supabase, role } = await getContext();
  if (role === "viewer" || role === "disabled") return { error: "View-only role." };
  const { data, error } = await supabase.rpc("enroll_leads", { p_sequence: id, p_leads: (leadIds || []).slice(0, 1000) });
  if (error) return { error: msg(error) };
  revalidatePath(`/app/leads/playbook/${id}`);
  return { ok: true, count: data };
}
