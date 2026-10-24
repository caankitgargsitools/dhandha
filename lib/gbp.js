// Google Business Profile helpers (tested in tests/gbp.test.mjs). The profile is read with Places API (New) using
// Dhandha's GOOGLE_MAPS_API_KEY; Google's own Business Profile API (posting, replying) needs OAuth and is not used.

const FIELDS = "id,displayName,formattedAddress,rating,userRatingCount,websiteUri,nationalPhoneNumber,regularOpeningHours,photos,businessStatus,googleMapsUri,primaryTypeDisplayName,reviews";

export async function placeDetails(placeId, key = process.env.GOOGLE_MAPS_API_KEY) {
  if (!key) return { error: "Google Maps is not switched on." };
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId || "")) return { error: "Not a Google place." };
  const r = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS }, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: j.error?.message || `Google ${r.status}` };
  return { place: j };
}

export const reviewUrl = (placeId) => `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;

// What a profile has and lacks, each with why it matters; and a 0–100 strength score.
export function profileHealth(p = {}, now = Date.now()) {
  const reviews = Number(p.userRatingCount || 0), rating = Number(p.rating || 0);
  const newest = (p.reviews || []).map((r) => Date.parse(r.publishTime)).filter(Boolean).sort((a, b) => b - a)[0];
  const fresh = newest ? (now - newest) / 86400000 <= 30 : false;
  const items = [
    { key: "open", ok: !p.businessStatus || p.businessStatus === "OPERATIONAL", label: "Shown as open", fix: "Your profile is not marked as operating — correct it in Google Business Profile.", weight: 10 },
    { key: "reviews", ok: reviews >= 25, part: Math.min(1, reviews / 25), label: `${reviews} review${reviews === 1 ? "" : "s"}`, fix: reviews < 25 ? `Aim for 25+ reviews — ${25 - reviews} to go. Turn on automatic review requests below.` : "", weight: 25 },
    { key: "rating", ok: rating >= 4.3, part: rating ? Math.max(0, Math.min(1, (rating - 3.5) / 0.8)) : 0, label: rating ? `Rated ${rating.toFixed(1)}` : "No rating yet", fix: rating && rating < 4.3 ? "Below 4.3 — reply to every critical review and ask every happy customer to review." : "", weight: 20 },
    { key: "fresh", ok: fresh, label: fresh ? "A review in the last 30 days" : "No review in the last 30 days", fix: fresh ? "" : "Google favours profiles with recent reviews — ask each customer you close.", weight: 15 },
    { key: "website", ok: !!p.websiteUri, label: "Website", fix: "Add your website.", weight: 8 },
    { key: "phone", ok: !!p.nationalPhoneNumber, label: "Phone number", fix: "Add a phone number so searchers can call.", weight: 8 },
    { key: "hours", ok: !!p.regularOpeningHours, label: "Opening hours", fix: "Add opening hours — profiles without them rank lower.", weight: 7 },
    { key: "photos", ok: (p.photos || []).length >= 10, part: Math.min(1, (p.photos || []).length / 10), label: `${(p.photos || []).length >= 10 ? "10+" : (p.photos || []).length} photo${(p.photos || []).length === 1 ? "" : "s"}`, fix: (p.photos || []).length < 10 ? "Add at least 10 photos: office, team, work done, signboard." : "", weight: 7 },
  ];
  const score = Math.round(items.reduce((t, i) => t + i.weight * (i.ok ? 1 : i.part || 0), 0));
  return { score, items, reviews, rating, fresh };
}

// Fill the review message: {name} first name, {company}, {link}.
export function fillReview(tpl, { contact, company, link }) {
  return String(tpl || "").replace(/\{name\}/g, String(contact || "").trim().split(/\s+/)[0] || "there").replace(/\{company\}/g, company || "").replace(/\{link\}/g, link || "");
}
