"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { placesSearch } from "@/lib/connectors";
import { placeDetails } from "@/lib/gbp";

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
