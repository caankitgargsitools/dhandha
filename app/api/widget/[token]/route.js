import { createHash } from "node:crypto";
import { anonClient } from "@/lib/supabase/anon";
import { domainAllowed } from "@/lib/widget";

// An enquiry from the website widget (or the hosted form). Checked and saved in SQL web_widget_lead.
const cors = (origin) => ({ "access-control-allow-origin": origin || "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" });

export async function POST(request, { params }) {
  const { token } = await params;
  const origin = request.headers.get("origin") || "";
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...cors(origin) } });
  if (!/^[0-9a-f-]{36}$/i.test(token || "")) return json({ error: "not found" }, 404);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad request" }, 400); }
  const db = anonClient();
  const { data: cfg } = await db.rpc("web_widget_view", { p_token: token });
  if (!cfg) return json({ error: "This form is switched off." }, 404);
  const self = origin && origin === new URL(request.url).origin; // the hosted form on Dhandha itself (the domain list is a convenience, not security)
  if (!self && !domainAllowed(cfg.domains, origin)) return json({ error: "This website is not allowed to use this form." }, 403);
  // the visitor's network, as Vercel saw it (not from the request body), hashed; enquiries are accepted only from this
  // server (WEB_FORM_KEY), so the per-network limit cannot be skipped by calling the database directly
  const ip = (request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`${token}:${ip}`).digest("hex").slice(0, 32);
  if (!process.env.WEB_FORM_KEY) return json({ error: "Enquiries are paused — please try again later." }, 503);
  const pick = (k, n) => String(body?.[k] ?? "").slice(0, n);
  const { error } = await db.rpc("web_widget_lead_form", { p_form_key: process.env.WEB_FORM_KEY, p_token: token, p: { name: pick("name", 120), company: pick("company", 120), phone: pick("phone", 20), email: pick("email", 200), message: pick("message", 1500), page: pick("page", 300), website_url_hp: pick("website_url_hp", 50) }, p_ip_hash: ipHash });
  if (error) return json({ error: error.message.replace(/^.*?: /, "") }, 400);
  return json({ ok: true });
}

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}
