"use server";
import { anonClient } from "@/lib/supabase/anon";

export async function respondQuote(token, accept, name, note) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This link is not valid." };
  const { data, error } = await anonClient().rpc("quote_respond", { p_token: token, p_accept: !!accept, p_name: String(name || "").slice(0, 120), p_note: String(note || "").slice(0, 1000) || null });
  if (error) return { error: error.message.replace(/^.*?ERROR:\s*/, "") };
  return { status: data };
}
