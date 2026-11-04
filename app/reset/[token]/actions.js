"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function applyReset(prev, formData) {
  const token = String(formData.get("token") || ""), password = String(formData.get("password") || "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: "This link is not valid." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== String(formData.get("again") || "")) return { error: "The two passwords are not the same." };
  const supabase = await createClient();
  const { data: email, error } = await supabase.rpc("password_reset_apply", { p_token: token, p_password: password });
  if (error) return { error: error.message };
  // sign straight in with the new password (2FA still asked when set up)
  const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
  redirect(e2 ? "/login?reset=1" : "/app");
}
