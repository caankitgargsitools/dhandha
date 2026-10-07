"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const LINKS = ["tender", "deal", "lead", "document", "ticket"];

export async function createTask(prev, formData) {
  const { supabase, tenant, company, user } = await getContext();
  const title = String(formData.get("title") || "").trim();
  if (title.length < 3) return { error: "Give the task a short title." };
  const due = String(formData.get("due") || "");
  const linkType = String(formData.get("link_type") || "");
  const row = {
    tenant_id: tenant.id, company_id: company.id, created_by: user.id, title,
    details: String(formData.get("details") || "").trim() || null,
    assigned_to: String(formData.get("assigned_to") || "") || null,
    due_at: due ? new Date(`${due}T18:00:00+05:30`).toISOString() : null,
    priority: ["low", "normal", "high", "urgent"].includes(formData.get("priority")) ? formData.get("priority") : "normal",
    link_type: LINKS.includes(linkType) ? linkType : null,
    link_id: LINKS.includes(linkType) ? String(formData.get("link_id") || "") || null : null,
    link_label: String(formData.get("link_label") || "") || null,
  };
  const { error } = await supabase.from("tasks").insert(row);
  if (error) return { error: error.message.includes("assignee") ? "That person is not in this workspace." : error.message };
  revalidatePath("/app/tasks");
  revalidatePath("/app");
  return { message: "Task assigned." };
}

export async function setTaskStatus(formData) {
  const { supabase } = await getContext();
  const status = String(formData.get("status"));
  if (!["todo", "in_progress", "done", "cancelled"].includes(status)) return;
  await supabase.from("tasks").update({ status }).eq("id", String(formData.get("id")));
  revalidatePath("/app/tasks");
  revalidatePath("/app");
}
