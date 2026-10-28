"use server";
import { anonClient } from "@/lib/supabase/anon";

export async function submitReferral(token, f) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This link is not valid." };
  const { error } = await anonClient().rpc("referral_submit", {
    p_token: token, p_name: f.name || "", p_contact: f.contact || "", p_phone: f.phone || "", p_email: f.email || "", p_city: f.city || "", p_note: f.note || "",
  });
  return error ? { error: error.message.replace(/^.*?ERROR:\s*/, "") } : { ok: true };
}
