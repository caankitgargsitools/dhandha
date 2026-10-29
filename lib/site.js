// One-page website builder (PENDING 39; pure, tested). A business gets dhandha.app/s/<slug>: headline, services,
// about, completed works and team from the Vault (what it chooses to show), contact buttons and the enquiry form
// (web_widgets) that turns visitors into leads. SQL site_save / site_view.

export function slugify(s = "") {
  return String(s).toLowerCase().replace(/&/g, " and ").replace(/\b(private|pvt|limited|ltd|llp)\b\.?/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}

// first draft from the Vault, used until the business saves its own
export function siteDefaults({ company = {}, services = [], city } = {}) {
  const name = company.trade_name || company.legal_name || "Our firm";
  const where = city || company.city;
  const since = company.incorporation_date ? new Date(company.incorporation_date).getFullYear() : null;
  return {
    slug: slugify(name), published: false,
    headline: name,
    tagline: [services.slice(0, 3).join(", "), where ? `in ${where}` : ""].filter(Boolean).join(" ") || "Trusted by businesses and government departments",
    about: `${name}${since ? `, working since ${since},` : ""} serves clients${where ? ` in ${where} and nearby` : ""}. Tell us what you need — we reply the same day.`,
    color: "#4f46e5",
    services: services.slice(0, 12).map((t) => ({ title: t, text: "" })),
    show_work: true, show_people: true,
    phone: company.phone || "", email: company.email || "", address: [company.registered_address, company.city, company.state].filter(Boolean).join(", "),
    whatsapp: company.phone || "",
    seo_title: `${name}${where ? ` — ${where}` : ""}`.slice(0, 70),
    seo_description: `${name}: ${services.slice(0, 4).join(", ")}${where ? ` in ${where}` : ""}. Call or send an enquiry.`.slice(0, 170),
  };
}

// schema.org data so Google understands the page (name, address, phone, services)
export function jsonLd(s, url) {
  return {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: s.name, url,
    ...(s.about ? { description: s.about.slice(0, 300) } : {}),
    ...(s.phone ? { telephone: s.phone } : {}), ...(s.email ? { email: s.email } : {}),
    ...(s.address || s.city ? { address: { "@type": "PostalAddress", streetAddress: s.address || undefined, addressLocality: s.city || undefined, addressRegion: s.state || undefined, addressCountry: "IN" } } : {}),
    ...(s.since ? { foundingDate: String(s.since) } : {}),
    ...(s.services?.length ? { makesOffer: s.services.map((x) => ({ "@type": "Offer", itemOffered: { "@type": "Service", name: x.title } })) } : {}),
  };
}

export const telHref = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length >= 10 ? `tel:+${d.length === 10 ? "91" + d : d}` : null; };

export function sitePrompt({ name, city, since, services, works }) {
  return `Write the text of a one-page website for an Indian business.
Business: "${name}"${city ? `, ${city}` : ""}${since ? `, working since ${since}` : ""}.
Services: ${services.join("; ") || "(not given)"}.
Some completed work: ${works.slice(0, 5).join("; ") || "(not given)"}.
Plain, confident, honest English — no superlatives you cannot prove ("best", "No. 1"), no prices, no invented awards or numbers.
Answer as JSON: {"headline": "<= 60 chars", "tagline": "<= 140 chars", "about": "80-140 words", "services": [{"title": "...", "text": "one line, <= 120 chars"}], "seo_title": "<= 60 chars", "seo_description": "<= 155 chars"}
Keep the services list to the services given (same titles, cleaned up).`;
}

export function cleanSiteText(d) {
  if (!d || typeof d.headline !== "string" || typeof d.about !== "string" || d.about.length < 40) return null;
  const s = (v, n) => String(v || "").trim().slice(0, n);
  return {
    headline: s(d.headline, 120), tagline: s(d.tagline, 240), about: s(d.about, 2000), seo_title: s(d.seo_title, 70), seo_description: s(d.seo_description, 170),
    services: Array.isArray(d.services) ? d.services.filter((x) => x?.title).slice(0, 24).map((x) => ({ title: s(x.title, 80), text: s(x.text, 300) })) : [],
  };
}
