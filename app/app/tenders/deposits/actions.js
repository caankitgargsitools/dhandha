"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

export async function saveDeposit(_prev, formData) {
  const { supabase, company } = await getContext();
  const p = Object.fromEntries(["id", "match_id", "kind", "amount", "mode", "reference", "bank", "paid_on", "valid_until", "status", "refund_expected_on", "refunded_on", "note"]
    .map((k) => [k, String(formData.get(k) ?? "").trim()]).filter(([, v]) => v !== ""));
  if (p.amount) p.amount = p.amount.replace(/[^0-9.]/g, "");
  const { error } = await supabase.rpc("deposit_save", { p_company: company.id, p });
  revalidatePath("/app/tenders/deposits");
  if (p.match_id) revalidatePath(`/app/tenders/${p.match_id}`);
  return error ? { error: error.message } : { ok: "Saved." };
}

export async function setDepositStatus(formData) {
  const { supabase, company } = await getContext();
  await supabase.rpc("deposit_save", { p_company: company.id, p: { id: String(formData.get("id")), status: String(formData.get("status")) } });
  revalidatePath("/app/tenders/deposits");
}
