"use server";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/admin";
import { readXlsx } from "@/lib/xlsx";
import { parseCsv } from "@/lib/leads";
import { mcaFromRows } from "@/lib/mca";

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

export async function saveBilling(prev, formData) {
  const { supabase } = await getAdminContext();
  const gstin = String(formData.get("seller_gstin") || "").trim().toUpperCase();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { error: "That GSTIN does not look right (15 characters, e.g. 06ABCDE1234F1Z5)." };
  const keys = ["seller_name", "seller_gstin", "seller_state", "seller_address", "sac_code", "invoice_prefix", "suite_fee_inr", "suite_credits", "min_topup_inr"];
  const p = Object.fromEntries(keys.map((k) => [k, String(formData.get(k) || "").trim()]));
  const { error } = await supabase.rpc("admin_set_billing", { p });
  if (error) return { error: error.message };
  revalidatePath("/admin/billing");
  return { message: "Saved." };
}

// Monthly MCA "companies registered" file (.xlsx or .csv) → shared mca_companies, in chunks.
export async function uploadMca(prev, formData) {
  const { supabase } = await getAdminContext();
  const file = formData.get("file");
  if (!file || typeof file === "string" || !file.size) return { error: "Choose the MCA file (.xlsx or .csv)." };
  let rows;
  try {
    rows = /\.xlsx$/i.test(file.name) ? readXlsx(Buffer.from(await file.arrayBuffer()), { maxRows: 60000 }) : parseCsv(await file.text());
  } catch (e) {
    return { error: `Could not read the file: ${e.message}` };
  }
  const { companies, skipped, error } = mcaFromRows(rows);
  if (error) return { error };
  if (!companies.length) return { error: `No rows with a valid CIN/LLPIN. ${skipped} skipped.` };
  const source = String(formData.get("label") || file.name).slice(0, 60);
  const t = { inserted: 0, updated: 0 };
  for (let i = 0; i < companies.length; i += 2000) {
    const { data, error: e } = await supabase.rpc("admin_ingest_mca", { p_rows: companies.slice(i, i + 2000), p_source: source });
    if (e) return { error: `Stopped after ${i} rows: ${e.message}` };
    t.inserted += data.inserted; t.updated += data.updated;
  }
  revalidatePath("/admin/mca");
  return { message: `${t.inserted} new companies, ${t.updated} updated${skipped ? `, ${skipped} rows skipped (no valid CIN)` : ""}.` };
}

export async function saveAppUrl(prev, formData) {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("admin_set_app_url", { p_url: String(formData.get("url") || "").trim().toLowerCase() });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  revalidatePath("/admin/outreach");
  return { message: "Saved. Background sending can now reach the site." };
}
