import "server-only";

// Facebook / Instagram Lead Ads through Dhandha's Meta app. Env (Vercel): META_APP_ID, META_APP_SECRET,
// META_VERIFY_TOKEN (any phrase, also typed into the app's webhook settings). The same app secret goes into
// Supabase Vault as meta_app_secret so the database can check webhook signatures.
const G = "https://graph.facebook.com/v21.0";
export const META_SCOPES = "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_manage_ads,leads_retrieval,business_management";
export const metaReady = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET);

export const metaAuthUrl = ({ redirectUri, state }) =>
  `https://www.facebook.com/v21.0/dialog/oauth?${new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: redirectUri, state, scope: META_SCOPES, response_type: "code" })}`;

async function get(path, params) {
  const r = await fetch(`${G}/${path}?${new URLSearchParams(params)}`, { cache: "no-store" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Meta error ${r.status}`);
  return data;
}

// code → short-lived user token → long-lived user token → pages (their tokens are then long-lived too)
export async function pagesFromCode(code, redirectUri) {
  const short = await get("oauth/access_token", { client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, redirect_uri: redirectUri, code });
  const long = await get("oauth/access_token", { grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID, client_secret: process.env.META_APP_SECRET, fb_exchange_token: short.access_token });
  const res = await get("me/accounts", { access_token: long.access_token, fields: "id,name,access_token,instagram_business_account{username}", limit: "100" });
  return (res.data || []).map((p) => ({ id: p.id, name: p.name, token: p.access_token, ig: p.instagram_business_account?.username || null }));
}

// Ask Meta to send this page's new leads to our webhook.
export async function subscribePage(pageId, pageToken) {
  const r = await fetch(`${G}/${pageId}/subscribed_apps`, { method: "POST", body: new URLSearchParams({ subscribed_fields: "leadgen", access_token: pageToken }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.success) throw new Error(data?.error?.message || "could not subscribe the page");
}

export async function fetchLead(leadgenId, pageToken) {
  const lead = await get(leadgenId, { access_token: pageToken, fields: "field_data,created_time,form_id,platform" });
  let formName = null;
  if (lead.form_id) { try { formName = (await get(lead.form_id, { access_token: pageToken, fields: "name" })).name; } catch { /* name is optional */ } }
  return { ...lead, form_name: formName };
}
