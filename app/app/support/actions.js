"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { CATEGORIES } from "@/lib/tickets";

export async function openTicket(prev, formData) {
  const { supabase, tenant, company, user } = await getContext();
  const subject = String(formData.get("subject") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const category = String(formData.get("category"));
  const priority = ["low", "normal", "high", "urgent"].includes(formData.get("priority")) ? formData.get("priority") : "normal";
  if (subject.length < 5) return { error: "Add a short subject (at least 5 characters)." };
  if (body.length < 10) return { error: "Describe the problem in a sentence or two." };
  if (!CATEGORIES[category]) return { error: "Choose what this is about." };
  const { data: t, error } = await supabase.from("tickets")
    .insert({ tenant_id: tenant.id, company_id: company.id, created_by: user.id, subject, category, priority })
    .select("id").single();
  if (error) return { error: error.message };
  const { error: e2 } = await supabase.from("ticket_messages").insert({ ticket_id: t.id, author: user.id, body });
  if (e2) return { error: e2.message };
  redirect(`/app/support/${t.id}`);
}

export async function replyTicket(prev, formData) {
  const { supabase, user } = await getContext();
  const id = String(formData.get("ticket_id"));
  const body = String(formData.get("body") || "").trim();
  if (!body) return { error: "Write a reply first." };
  const { error } = await supabase.from("ticket_messages").insert({ ticket_id: id, author: user.id, body });
  if (error) return { error: error.message };
  revalidatePath(`/app/support/${id}`);
  return { message: "Reply sent." };
}

export async function closeTicket(formData) {
  const { supabase } = await getContext();
  const id = String(formData.get("ticket_id"));
  await supabase.rpc("close_ticket", { p_ticket: id });
  revalidatePath(`/app/support/${id}`);
  revalidatePath("/app/support");
}
