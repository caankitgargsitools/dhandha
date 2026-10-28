"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { computeQuote } from "@/lib/quote";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

// Totals are always worked out here (not trusted from the browser), then stored with the quotation.
export async function saveQuote(id, v) {
  const { supabase, company } = await getContext();
  const { data: c } = await supabase.from("companies").select("gstin, state").eq("id", company.id).single();
  const totals = computeQuote(v.lines, { seller: c || {}, buyer: { gstin: v.client_gstin, state: v.client_state }, discount: v.discount });
  const { data, error } = await supabase.rpc("quote_save", { p_id: id || null, p_company: company.id, p_data: { ...v, lines: totals.items, totals } });
  if (error) return { error: msg(error) };
  revalidatePath("/app/crm/quotes");
  return { id: data };
}

export async function sendQuote(id) {
  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc("quote_send", { p_id: id });
  if (error) return { error: msg(error) };
  revalidatePath(`/app/crm/quotes/${id}`);
  return { token: data };
}
