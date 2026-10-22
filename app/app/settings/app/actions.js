"use server";
import { headers } from "next/headers";
import webpush from "web-push";
import { getContext } from "@/lib/session";

// The public key phones subscribe with. The first time the platform admin opens this page, the key pair is made
// here and the private half goes straight into Supabase Vault (it is never shown or stored anywhere else).
// The site address is saved too if it is not set yet (the database uses it to wake the notification sender).
export async function pushSetup() {
  const { supabase, isPlatformAdmin } = await getContext();
  let { data: pub } = await supabase.rpc("push_public_key");
  if (isPlatformAdmin) {
    if (!pub) {
      const k = webpush.generateVAPIDKeys();
      const { error } = await supabase.rpc("push_init_keys", { p_public: k.publicKey, p_private: k.privateKey });
      if (!error) pub = k.publicKey;
    }
    const { data: url } = await supabase.rpc("admin_get_app_url");
    if (!url) {
      const h = await headers();
      const host = h.get("x-forwarded-host") || h.get("host");
      if (host && !/localhost|127\.0\.0\.1/.test(host)) await supabase.rpc("admin_set_app_url", { p_url: `https://${host}`.toLowerCase() });
    }
  }
  return { publicKey: pub || null };
}

export async function saveDevice({ endpoint, p256dh, auth, device }) {
  const { supabase, user } = await getContext();
  if (!/^https:\/\//.test(String(endpoint))) return { error: "This browser did not give a valid subscription." };
  const { data: mine } = await supabase.from("push_subscriptions").select("id").eq("endpoint", endpoint).maybeSingle();
  const row = { user_id: user.id, endpoint, p256dh, auth, device: String(device || "").slice(0, 120), revoked_at: null };
  const { error } = mine ? await supabase.from("push_subscriptions").update(row).eq("id", mine.id) : await supabase.from("push_subscriptions").insert(row);
  return error ? { error: error.message } : { ok: true };
}

export async function dropDevice({ endpoint }) {
  const { supabase } = await getContext();
  await supabase.from("push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("endpoint", endpoint);
  return { ok: true };
}

export async function testPush() {
  const { supabase } = await getContext();
  const { error } = await supabase.rpc("push_test");
  return error ? { error: error.message } : { ok: true };
}
