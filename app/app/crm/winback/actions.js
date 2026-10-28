"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";

const msg = (e) => String(e?.message || e).replace(/^.*?ERROR:\s*/, "");

export async function getReferralLink(leadId) {
  const { supabase } = await getContext();
  const { data, error } = await supabase.rpc("referral_link", { p_lead: leadId });
  if (error) return { error: msg(error) };
  const h = await headers();
  return { link: `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}/ref/${data}` };
}

export async function saveWinback(_prev, formData) {
  const { supabase, company } = await getContext();
  const { error } = await supabase.rpc("winback_save", {
    p_company: company.id, p_enabled: formData.get("enabled") === "1", p_lost: Number(formData.get("lost_days")) || 90,
    p_idle: Number(formData.get("idle_days")) || 180, p_sequence: formData.get("sequence_id") || null,
  });
  if (error) return { error: msg(error) };
  revalidatePath("/app/crm/winback");
  return { message: "Saved." };
}
