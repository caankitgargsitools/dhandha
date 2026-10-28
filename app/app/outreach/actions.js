"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";

const str = (f, k, max = 200) => String(f.get(k) || "").trim().slice(0, max);
const isLead = (role) => ["admin", "manager"].includes(role);
const msg = (e) => e.message.replace(/^.*?ERROR:\s*/, "");

export async function createSequence(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (!isLead(role)) return { error: "Only admins and managers can create sequences." };
  const name = str(formData, "name", 120);
  if (name.length < 2) return { error: "Give the sequence a name." };
  const { data, error } = await supabase.from("sequences").insert({ tenant_id: tenant.id, company_id: company.id, name }).select("id").single();
  if (error) return { error: error.message };
  // a sensible first step to edit
  await supabase.from("sequence_steps").insert({ sequence_id: data.id, step_no: 1, day_offset: 0, channel: "email",
    subject: "{business} and {our_company}", body: "Dear {name},\n\nI am writing from {our_company}. We help businesses like {business} in {city} with …\n\nCould we speak for 10 minutes this week?\n\nRegards" });
  redirect(`/app/outreach/${data.id}`);
}

export async function saveStep(prev, formData) {
  const { supabase, role } = await getContext();
  if (!isLead(role)) return { error: "Only admins and managers can edit sequences." };
  const seq = String(formData.get("sequence_id"));
  const channel = formData.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const row = {
    sequence_id: seq, step_no: Math.min(10, Math.max(1, Number(formData.get("step_no")) || 1)),
    day_offset: Math.min(90, Math.max(0, Number(formData.get("day_offset")) || 0)), channel,
    subject: channel === "email" ? str(formData, "subject", 200) : null, body: channel === "email" ? str(formData, "body", 5000) : null,
    wa_template: channel === "whatsapp" ? str(formData, "wa_template", 512).toLowerCase() : null, wa_lang: str(formData, "wa_lang", 10) || "en",
  };
  if (channel === "email" && (!row.subject || !row.body)) return { error: "An email step needs a subject and a message." };
  if (channel === "whatsapp" && !/^[a-z0-9_]+$/.test(row.wa_template || "")) return { error: "Enter the approved template name exactly as in WhatsApp Manager (small letters, numbers, _)." };
  // editing a step changes that step (by id); a new step is added only if its number is free
  const id = String(formData.get("id") || "");
  const { error } = id
    ? await supabase.from("sequence_steps").update(row).eq("id", id).eq("sequence_id", seq)
    : await supabase.from("sequence_steps").insert(row);
  if (error) return { error: error.code === "23505" ? `There is already a step ${row.step_no}. Pick another number or edit that step.` : error.message };
  revalidatePath(`/app/outreach/${seq}`);
  return { message: "Step saved." };
}

export async function removeStep(formData) {
  const { supabase, role } = await getContext();
  if (!isLead(role)) return;
  const seq = String(formData.get("sequence_id"));
  await supabase.from("sequence_steps").delete().eq("id", String(formData.get("id"))).eq("sequence_id", seq);
  revalidatePath(`/app/outreach/${seq}`);
}

export async function toggleSequence(formData) {
  const { supabase, role } = await getContext();
  if (!isLead(role)) return;
  const id = String(formData.get("id"));
  await supabase.from("sequences").update({ active: formData.get("active") === "1" }).eq("id", id);
  revalidatePath(`/app/outreach/${id}`);
  revalidatePath("/app/outreach");
}

// Enrol every lead in a view (as the person sees it; telecallers only their own).
export async function enrollByFilter(prev, formData) {
  const { supabase, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot enrol leads." };
  const seq = String(formData.get("sequence_id"));
  const filter = String(formData.get("filter") || "new");
  let q = supabase.from("leads").select("id").eq("company_id", company.id).eq("dnd", false).not("status", "in", "(converted,junk,not_interested)");
  if (filter === "new") q = q.eq("status", "new");
  if (filter === "hot") q = q.gte("score", 70);
  if (filter.startsWith("source:")) q = q.eq("source", filter.slice(7));
  if (formData.get("needs") === "email") q = q.not("email", "is", null).eq("email_opt_out", false);
  if (formData.get("needs") === "whatsapp") q = q.eq("wa_opt_in", true).neq("phone_norm", "");
  const { data: leads, error } = await q.limit(1000);
  if (error) return { error: error.message };
  if (!leads.length) return { error: "No leads match." };
  const { data: n, error: e2 } = await supabase.rpc("enroll_leads", { p_sequence: seq, p_leads: leads.map((l) => l.id) });
  if (e2) return { error: msg(e2) };
  revalidatePath(`/app/outreach/${seq}`);
  revalidatePath(`/app/leads/playbook/${seq}`);
  return { message: `${n} leads enrolled.${leads.length > n ? ` ${leads.length - n} were already in it.` : ""}` };
}

export async function enrollOne(prev, formData) {
  const { supabase, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot enrol leads." };
  const lead = String(formData.get("lead_id"));
  const { data: n, error } = await supabase.rpc("enroll_leads", { p_sequence: String(formData.get("sequence_id")), p_leads: [lead] });
  if (error) return { error: msg(error) };
  revalidatePath(`/app/leads/${lead}`);
  return n ? { message: "Added to the sequence." } : { error: "Already in that sequence, closed, or do-not-disturb." };
}

export async function setEnrollment(formData) {
  const { supabase } = await getContext();
  const status = String(formData.get("status"));
  if (!["active", "paused", "stopped"].includes(status)) return;
  const patch = { status, ...(status === "stopped" ? { stopped_reason: "stopped by hand", next_at: null } : {}) };
  if (status === "active") patch.next_at = new Date().toISOString();
  await supabase.from("enrollments").update(patch).eq("id", String(formData.get("id")));
  revalidatePath(`/app/outreach/${formData.get("sequence_id")}`);
  revalidatePath(`/app/leads/playbook/${formData.get("sequence_id")}`);
}

export async function sendOne(prev, formData) {
  const { supabase, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot send messages." };
  const lead = String(formData.get("lead_id"));
  const channel = formData.get("channel") === "whatsapp" ? "whatsapp" : "email";
  const { error } = await supabase.rpc("queue_message", {
    p_lead: lead, p_channel: channel, p_subject: str(formData, "subject", 200), p_body: str(formData, "body", 5000),
    p_wa_template: str(formData, "wa_template", 512).toLowerCase(), p_wa_lang: str(formData, "wa_lang", 10) || "en",
  });
  if (error) return { error: msg(error) };
  await supabase.rpc("outreach_kick");
  revalidatePath(`/app/leads/${lead}`);
  return { message: "Queued. It goes out within a few minutes and appears in the timeline." };
}

export async function saveOutreachSettings(prev, formData) {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can change this." };
  const { error } = await supabase.rpc("save_outreach_settings", { p_tenant: tenant.id, p: {
    from_name: str(formData, "from_name", 80), reply_to: str(formData, "reply_to", 200),
    wa_phone_number_id: str(formData, "wa_phone_number_id", 40), wa_display_number: str(formData, "wa_display_number", 20),
  } });
  if (error) return { error: msg(error) };
  const token = String(formData.get("wa_token") || "").trim();
  if (token) {
    const { error: e2 } = await supabase.rpc("set_whatsapp_token", { p_tenant: tenant.id, p_token: token });
    if (e2) return { error: msg(e2) };
  }
  revalidatePath("/app/outreach/settings");
  return { message: token ? "Saved. WhatsApp is connected." : "Saved." };
}

export async function disconnectWhatsApp() {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return;
  await supabase.rpc("disconnect_whatsapp", { p_tenant: tenant.id });
  revalidatePath("/app/outreach/settings");
}

// WhatsApp inbox set-up (webhook address, verify token, app secret, auto-reply, assignment)
export async function saveInboxSetup(v) {
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can set this up." };
  const { data, error } = await supabase.rpc("wa_inbox_setup", {
    p_tenant: tenant.id, p_app_secret: String(v.secret || "").trim() || null, p_auto_reply: v.auto_reply ?? null, p_auto_when: v.auto_when || null, p_assign: v.assign || null,
  });
  if (error) return { error: /does not exist/.test(error.message) ? "The WhatsApp inbox is being switched on — try again shortly." : error.message.replace(/^.*?ERROR:\s*/, "") };
  return { data };
}
