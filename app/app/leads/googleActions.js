"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { placesSearch } from "@/lib/connectors";
import { placeDetails } from "@/lib/gbp";
import { runJson, aiTiers } from "@/lib/ai";
import { reviewList, replyPrompt, postPrompt, cleanReply, cleanPost } from "@/lib/reviewReply";

// Google Ads: a new webhook key (the old one stops working). Shown once.
export async function newGoogleAdsKey() {
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can do this." };
  const { data, error } = await supabase.rpc("google_ads_hook_new", { p_company: company.id });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/google-ads");
  return { ok: true, token: data.token, key: data.key };
}

// Google Business Profile: find your own business on Google Maps.
export async function findMyBusiness(query) {
  const { isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can do this." };
  const q = String(query || "").trim().slice(0, 120);
  if (q.length < 3) return { error: "Type your business name and city." };
  const r = await placesSearch({ query: q });
  if (r.error) return { error: r.error === "not_configured" ? "Google Maps is not switched on." : r.error };
  return { places: r.places.slice(0, 8).map((p) => ({ id: p.id, name: p.displayName?.text, address: p.formattedAddress, rating: p.rating || null, reviews: p.userRatingCount || 0 })) };
}

// Read the profile now and store a snapshot (rating and review count per day, for the trend).
export async function refreshProfile(placeId) {
  const { supabase, tenant, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can do this." };
  const pid = placeId || (await supabase.from("review_settings").select("place_id").eq("company_id", company.id).maybeSingle()).data?.place_id;
  if (!pid) return { error: "Choose your business first." };
  const { place, error } = await placeDetails(pid);
  if (error) return { error };
  const { error: e2 } = await supabase.from("review_settings").upsert({
    company_id: company.id, tenant_id: tenant.id, place_id: place.id, place_name: place.displayName?.text || null, place_address: place.formattedAddress || null,
    maps_url: place.googleMapsUri || null, rating: place.rating ?? null, reviews: place.userRatingCount ?? 0, details: place, checked_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  if (e2) return { error: e2.message };
  await supabase.from("gbp_snapshots").upsert({ company_id: company.id, taken_on: new Date().toISOString().slice(0, 10), rating: place.rating ?? null, reviews: place.userRatingCount ?? 0 }, { onConflict: "company_id,taken_on" });
  revalidatePath("/app/leads/google-profile");
  return { ok: true };
}

export async function saveReviewSettings(prev, formData) {
  const { supabase, tenant, company, isAdmin } = await getContext();
  if (!isAdmin) return { error: "Only the workspace admin can do this." };
  const message = String(formData.get("message") || "").trim().slice(0, 1000);
  if (!message.includes("{link}")) return { error: "Keep {link} in the message — it is where the review link goes." };
  const { error } = await supabase.from("review_settings").upsert({
    company_id: company.id, tenant_id: tenant.id, auto_ask: formData.get("auto_ask") === "on",
    delay_days: Math.min(30, Math.max(0, Number(formData.get("delay_days")) || 0)),
    subject: String(formData.get("subject") || "").trim().slice(0, 150) || "A quick favour, {name}?", message, updated_at: new Date().toISOString(),
  }, { onConflict: "company_id" });
  if (error) return { error: error.message };
  revalidatePath("/app/leads/google-profile");
  return { message: "Saved." };
}

// Reply to a Google review / write a profile post with AI. Reviews and posts are public text, so the free AI tier
// may write them (private:false); 1 credit only when a paid tier answered.
async function aiDraft(ctx, task, prompt, validate) {
  const { supabase, tenant } = ctx;
  const ai = await runJson({ supabase, tenantId: tenant.id, task, private: false, fast: true, maxTokens: 500, budgetMs: 45000, prompt, validate: (d) => (validate(d) ? null : "empty") });
  if (ai.error) return { error: `The AI did not answer: ${ai.error}` };
  const paid = !aiTiers().find((t) => t.id === ai.engine)?.free;
  if (paid) {
    const { error } = await supabase.rpc("spend_credits", { p_tenant: tenant.id, p_action: "gbp_ai", p_qty: 1, p_ref: task });
    if (error) return { error: /insufficient|credits/i.test(error.message) ? "Not enough credits — top up in Credits & plan." : error.message };
  }
  return { data: validate(ai.data), paid };
}

export async function draftReviewReply(index, tone) {
  const ctx = await getContext();
  const { supabase, company, role } = ctx;
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers reply to reviews." };
  const { data: s } = await supabase.from("review_settings").select("place_name, details").eq("company_id", company.id).maybeSingle();
  const review = reviewList(s?.details)[Number(index)];
  if (!review) return { error: "Refresh the profile and try again." };
  const r = await aiDraft(ctx, "gbp_reply", replyPrompt({ review, business: s.place_name || company.legal_name, tone }), cleanReply);
  return r.error ? r : { reply: r.data, paid: r.paid };
}

export async function draftProfilePost(topic, kind) {
  const ctx = await getContext();
  const { supabase, company, role } = ctx;
  if (!["admin", "manager"].includes(role)) return { error: "Only admins and managers write posts." };
  const t = String(topic || "").trim();
  if (t.length < 5) return { error: "Say in a few words what the post is about." };
  const { data: s } = await supabase.from("review_settings").select("place_name, details").eq("company_id", company.id).maybeSingle();
  const r = await aiDraft(ctx, "gbp_post", postPrompt({ business: s?.place_name || company.legal_name, category: s?.details?.primaryTypeDisplayName?.text, topic: t, kind }), cleanPost);
  return r.error ? r : { ...r.data, paid: r.paid };
}
