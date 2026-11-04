"use server";
import { createClient } from "@/lib/supabase/server";

// Forgot password: Dhandha has no mail sender yet, so the request makes a one-time link that the person's workspace
// admin (and Dhandha's support) can copy from Team and send them. The answer is the same whether or not the e-mail exists.
export async function requestReset(prev, formData) {
  const email = String(formData.get("email") || "").trim().slice(0, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Type the e-mail you sign in with." };
  const supabase = await createClient();
  await supabase.rpc("password_reset_request", { p_email: email });
  return { message: "Done. If this e-mail has a Dhandha login, your workspace admin has been asked to send you a reset link (on WhatsApp or chat). It works for 24 hours. If you are the admin yourself, raise it with Dhandha support." };
}
