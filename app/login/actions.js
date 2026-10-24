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

// From a workspace invite link: the link itself confirms the email (SQL confirm_invited_signup checks the token is
// open and for this address), so the person is not left waiting for a confirmation mail.
const inviteOf = (formData) => { const t = String(formData.get("invite") || ""); return /^[0-9a-f-]{36}$/i.test(t) ? t : null; };
async function confirmByInvite(supabase, token, email) {
  if (!token) return false;
  const { data } = await supabase.rpc("confirm_invited_signup", { p_token: token, p_email: email });
  return !!data;
}

export async function signIn(prev, formData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim(), password = String(formData.get("password") || "");
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error?.message === "Email not confirmed" && (await confirmByInvite(supabase, inviteOf(formData), email))) {
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) return { error: error.message === "Email not confirmed" ? "Please confirm your email first — check your inbox (and spam)." : error.message };
  redirect("/app");
}

export async function signUp(prev, formData) {
  const supabase = await createClient();
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  const email = String(formData.get("email") || "").trim();
  const invite = inviteOf(formData);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await origin()}/auth/callback`,
      data: { full_name: String(formData.get("full_name") || "").trim(), phone: String(formData.get("phone") || "").trim() },
    },
  });
  // already signed up from this invite earlier (and stuck waiting for the mail): confirm and sign in
  if (error && !/already registered/i.test(error.message)) return { error: error.message };
  if (data?.session) redirect("/onboarding");
  if (await confirmByInvite(supabase, invite, email)) {
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (!e2) redirect("/app");
    return { error: /invalid/i.test(e2.message) ? "This email already has a Dhandha login — sign in with its password." : e2.message };
  }
  if (error) return { error: error.message };
  return { message: "Check your email and click the confirmation link to continue." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
