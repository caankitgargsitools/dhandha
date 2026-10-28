// Outside lead sources. Google Maps uses Dhandha's Places API key (GOOGLE_MAPS_API_KEY in Vercel); Apollo uses
// each workspace's own Apollo key from Vault. Mappers are pure (tested); the fetchers run on the server only.

const pick = (comps, type) => (comps || []).find((c) => (c.types || []).includes(type))?.longText || null;

// Places API (New) result → lead row
export function mapPlace(p, { industry } = {}) {
  const comps = p.addressComponents;
  return {
    name: p.displayName?.text || "",
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
    website: p.websiteUri || null,
    city: pick(comps, "locality") || pick(comps, "administrative_area_level_3") || null,
    state: pick(comps, "administrative_area_level_1") || null,
    industry: industry || p.primaryTypeDisplayName?.text || null,
    notes: [p.formattedAddress && `Address: ${p.formattedAddress}`, p.rating && `Google rating ${p.rating} (${p.userRatingCount || 0} reviews)`, p.googleMapsUri && `Maps: ${p.googleMapsUri}`].filter(Boolean).join("\n") || null,
    _id: p.id, _address: p.formattedAddress || "", _rating: p.rating || null, _reviews: p.userRatingCount || 0,
  };
}

export async function placesSearch({ query, pageToken, key = process.env.GOOGLE_MAPS_API_KEY }) {
  if (!key) return { error: "not_configured" };
  let r;
  try {
    r = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "content-type": "application/json", "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.googleMapsUri,nextPageToken",
      },
      body: JSON.stringify({ textQuery: query, regionCode: "IN", languageCode: "en", pageSize: 20, ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    return { error: e?.name === "TimeoutError" ? "Google Maps did not answer in time. Try again." : `Could not reach Google Maps (${e?.message || "network error"}).` };
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { error: j.error?.message || `Google Maps ${r.status}` };
  return { places: j.places || [], next: j.nextPageToken || null };
}

// Apollo person → lead row (people search gives name, title, company, place, LinkedIn; email/phone need enrichment)
export function mapApolloPerson(p) {
  const org = p.organization || {};
  const name = [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(" ").trim();
  return {
    name: org.name || name,
    contact_person: name || null,
    city: p.city || org.city || null,
    state: p.state || org.state || null,
    industry: org.industry || null,
    website: org.website_url || (org.primary_domain ? `https://${org.primary_domain}` : null),
    linkedin_url: p.linkedin_url || null,
    email: p.email && !/not_unlocked|email_not/i.test(p.email) ? p.email : null,
    notes: [p.title && `${name || "Contact"}: ${p.title}`, org.estimated_num_employees && `About ${org.estimated_num_employees} employees`, "Found on Apollo"].filter(Boolean).join("\n"),
    _id: p.id, _title: p.title || "", _org: org.name || "",
  };
}

export async function apolloSearch({ key, titles = [], locations = [], keywords = "", page = 1 }) {
  const r = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-cache", "x-api-key": key },
    body: JSON.stringify({ person_titles: titles, person_locations: locations, q_keywords: keywords || undefined, page, per_page: 25 }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) return { error: "Apollo did not accept the API key (or your plan does not include API search)." };
  if (!r.ok) return { error: j.error || j.message || `Apollo ${r.status}` };
  return { people: j.people || j.contacts || [], total: j.pagination?.total_entries ?? j.total_entries ?? null };
}
