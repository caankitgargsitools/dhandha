import { anonClient } from "@/lib/supabase/anon";
import { leadFromEmail } from "@/lib/emailLead";

// Email enquiries → leads (one address per company). The customer's mailbox script (Google Apps Script in their own
// Google account, or any service that can POST JSON) sends each new email here with its key in x-dhandha-key;
// the email becomes a lead row here and SQL checks the key, skips repeats and files it.
export async function POST(request, { params }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("not found", { status: 404 });
  const key = request.headers.get("x-dhandha-key") || "";
  if (!/^[0-9a-f]{36}$/.test(key)) return new Response("forbidden", { status: 403 });
  const mail = await request.json().catch(() => null);
  if (!mail || typeof mail !== "object") return new Response("bad request", { status: 400 });
  const db = anonClient();
  const { data: own } = await db.rpc("email_hook_domains", { p_token: token, p_key: key });
  const lead = leadFromEmail(mail, own || []);
  const { data, error } = await db.rpc("email_lead", { p_token: token, p_key: key, p_mail: lead.skip ? { skip: lead.skip } : lead });
  if (error) {
    if (/bad key/.test(error.message)) return new Response("forbidden", { status: 403 });
    // too many today: the script keeps it and tries again later; no sender address: nothing to file, do not resend
    if (/too many/.test(error.message)) return Response.json({ ok: false, error: error.message }, { status: 429 });
    if (/no sender/.test(error.message)) return Response.json({ ok: false, error: error.message });
    console.error("email lead", error.message);
    return new Response("error", { status: 500 });
  }
  return Response.json(data || { ok: true });
}
