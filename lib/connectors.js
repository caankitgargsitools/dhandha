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

// Apollo enrichment: find a lead's email (and any phone Apollo already shows) from the contact's name + company / website.
// Uses the workspace's own Apollo key and credits; Dhandha only fills fields that are empty.
export function apolloMatchParams(lead) {
  const parts = String(lead.contact_person || "").trim().split(/\s+/).filter(Boolean);
  let domain = null;
  try { domain = lead.website ? new URL(/^https?:/i.test(lead.website) ? lead.website : `https://${lead.website}`).hostname.replace(/^www\./, "") : null; } catch { domain = null; }
  const p = {
    first_name: parts[0] || undefined, last_name: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    organization_name: lead.name || undefined, domain: domain || undefined, linkedin_url: lead.linkedin_url || undefined,
    reveal_personal_emails: false,
  };
  if (!p.linkedin_url && !(p.first_name && (p.domain || p.organization_name))) return null; // Apollo needs a person to look for
  return p;
}

export function mapApolloMatch(j) {
  const p = j?.person || null;
  if (!p) return {};
  const email = p.email && !/not_unlocked|email_not|domain\.com$/i.test(p.email) ? p.email : null;
  const phone = (p.phone_numbers || []).map((x) => x.sanitized_number || x.raw_number).find(Boolean)
    || p.organization?.sanitized_phone || p.organization?.phone || null;
  return { email, phone, linkedin_url: p.linkedin_url || null, title: p.title || null };
}

export async function apolloMatch({ key, lead }) {
  const params = apolloMatchParams(lead);
  if (!params) return { error: "Add the contact person's name (and the company or website) first." };
  const r = await fetch("https://api.apollo.io/api/v1/people/match", {
    method: "POST",
    headers: { "content-type": "application/json", "cache-control": "no-cache", "x-api-key": key },
    body: JSON.stringify(params), signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 || r.status === 403) return { error: "Apollo did not accept the API key (or your plan does not include enrichment)." };
  if (r.status === 429) return { error: "Apollo's rate limit — try again in a minute." };
  if (!r.ok) return { error: j.error || j.message || `Apollo ${r.status}` };
  return mapApolloMatch(j);
}
