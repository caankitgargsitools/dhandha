"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";

export async function adjustCredits(prev, formData) {
  const { supabase } = await getAdminContext();
  const tenant = String(formData.get("tenant_id"));
  const delta = Number(String(formData.get("delta") || "").replace(/,/g, ""));
  const reason = String(formData.get("reason") || "").trim();
  if (!Number.isFinite(delta) || delta === 0) return { error: "Enter a non-zero amount (use minus to deduct)." };
  if (!reason) return { error: "Add a reason; the customer sees it in their usage history." };
  const { data, error } = await supabase.rpc("admin_adjust_credits", { p_tenant: tenant, p_delta: delta, p_reason: reason });
  if (error) return { error: error.message };
  revalidatePath(`/admin/tenants/${tenant}`);
  return { message: `Done. New balance: ${Number(data).toLocaleString("en-IN")} credits.` };
}

export async function staffReply(prev, formData) {
  const { supabase } = await getAdminContext();
  const id = String(formData.get("ticket_id"));
  const body = String(formData.get("body") || "").trim();
  const status = String(formData.get("status") || "") || null;
  if (!body && !status) return { error: "Write a reply or change the status." };
  const { error } = await supabase.rpc("admin_reply_ticket", { p_ticket: id, p_body: body, p_status: status });
  if (error) return { error: error.message };
  revalidatePath(`/admin/tickets/${id}`);
  revalidatePath("/admin/tickets");
  return { message: body ? "Reply sent." : "Status updated." };
}

export async function setPriority(formData) {
  const { supabase } = await getAdminContext();
  const id = String(formData.get("ticket_id"));
  await supabase.rpc("admin_set_ticket", { p_ticket: id, p_status: null, p_priority: String(formData.get("priority")) });
  revalidatePath(`/admin/tickets/${id}`);
}

export async function savePrice(prev, formData) {
  const { supabase } = await getAdminContext();
  const credits = Number(formData.get("credits"));
  if (!Number.isFinite(credits) || credits < 0) return { error: "Price must be zero or more." };
  const { error } = await supabase.rpc("admin_set_price", { p_action: String(formData.get("action_code")), p_credits: credits });
  if (error) return { error: error.message };
  revalidatePath("/admin/pricing");
  return { message: "Saved." };
}

export async function saveModule(prev, formData) {
  const { supabase } = await getAdminContext();
  const fee = Number(formData.get("fee")), credits = Number(formData.get("credits"));
  if (!(fee >= 0) || !(credits >= 0)) return { error: "Fee and credits must be zero or more." };
  const { error } = await supabase.rpc("admin_set_module", { p_code: String(formData.get("code")), p_fee: fee, p_credits: credits });
  if (error) return { error: error.message };
  revalidatePath("/admin/pricing");
  return { message: "Saved." };
}
