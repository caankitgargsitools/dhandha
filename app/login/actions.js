"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export async function signIn(prev, formData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  });
  if (error) return { error: error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox." : error.message };
  redirect("/app");
}

export async function signUp(prev, formData) {
  const supabase = await createClient();
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") || "").trim(),
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      data: { full_name: String(formData.get("full_name") || "").trim(), phone: String(formData.get("phone") || "").trim() },
    },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/onboarding");
  return { message: "Check your email and click the confirmation link to continue." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
