"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { computeQuote } from "@/lib/quote";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

// totals are always worked out here (not trusted from the browser)
export async function saveInvoice(id, v) {
  const { supabase, company } = await getContext();
  const { data: c } = await supabase.from("companies").select("gstin, state").eq("id", company.id).single();
  const totals = computeQuote(v.lines, { seller: c || {}, buyer: { gstin: v.client_gstin, state: v.client_state }, discount: v.discount });
  const { data, error } = await supabase.rpc("invoice_save", { p_id: id || null, p_company: company.id, p: { ...v, repeat_months: v.repeat_months ? String(v.repeat_months) : "", lines: totals.items, totals } });
  if (error) return { error: msg(error) };
  revalidatePath("/app/crm/invoices");
  return { id: data };
}

export async function issueInvoice(id) {
  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc("invoice_issue", { p_id: id });
  if (error) return { error: msg(error) };
  revalidatePath(`/app/crm/invoices/${id}`);
  revalidatePath("/app/crm/invoices");
  return { token: data };
}

export async function addPayment(_prev, formData) {
  const { supabase } = await getContext();
  const id = String(formData.get("id"));
  const { error } = await supabase.rpc("invoice_payment_add", { p_invoice: id, p_amount: Number(String(formData.get("amount") || "").replace(/[^0-9.]/g, "")) || 0,
    p_paid_on: String(formData.get("paid_on") || "") || null, p_mode: String(formData.get("mode") || ""), p_ref: String(formData.get("reference") || "").slice(0, 120) });
  revalidatePath(`/app/crm/invoices/${id}`);
  revalidatePath("/app/crm/invoices");
  return error ? { error: msg(error) } : { ok: "Payment recorded." };
}

export async function cancelInvoice(formData) {
  const { supabase } = await getContext();
  const id = String(formData.get("id"));
  await supabase.rpc("invoice_cancel", { p_id: id });
  revalidatePath(`/app/crm/invoices/${id}`);
  revalidatePath("/app/crm/invoices");
}

export async function saveInvoiceSettings(_prev, formData) {
  const { supabase, company } = await getContext();
  const { error } = await supabase.rpc("invoice_settings_save", { p_company: company.id, p: {
    upi_id: String(formData.get("upi_id") || "").trim(), due_days: String(formData.get("due_days") || "15"), reminders: formData.get("reminders") === "on", terms: String(formData.get("terms") || "") } });
  revalidatePath("/app/crm/invoices");
  return error ? { error: /upi_id/.test(error.message) ? "That UPI ID does not look right (e.g. yourname@okicici)." : msg(error) } : { ok: "Saved." };
}
