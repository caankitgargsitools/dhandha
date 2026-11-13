// Posts calendar & brand voice (owner, map item 8; 13 Nov): plan a month of posts, write them free from templates in
// the firm's own voice, or with AI (public business text only, so the free tier goes first). Pure and tested.

export const CHANNELS = {
  google: { label: "Google profile", max: 1500 },
  linkedin: { label: "LinkedIn", max: 3000 },
  facebook: { label: "Facebook", max: 2000 },
  instagram: { label: "Instagram", max: 2200 },
  whatsapp: { label: "WhatsApp status", max: 700 },
  x: { label: "X", max: 280 },
};
export const TONES = {
  friendly: "friendly and simple", professional: "professional and precise", bold: "confident and bold",
  warm: "warm and personal", expert: "expert, with one useful fact",
};
export const THEMES = {
  tip: "A useful tip", service: "One of our services", work: "Work we completed", review: "Thank you to clients",
  team: "Behind the scenes", occasion: "Occasion / greeting", offer: "Call to action",
};

// fixed-date days a business in India can post about (festivals move every year, so they are added by the person)
export const OCCASIONS = {
  "01-01": "New Year", "01-26": "Republic Day", "03-08": "International Women's Day", "05-01": "Labour Day",
  "06-27": "MSME Day", "07-01": "CA Day and GST Day", "08-15": "Independence Day", "09-05": "Teachers' Day",
  "09-15": "Engineers' Day", "10-02": "Gandhi Jayanti", "12-25": "Christmas",
};

const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
// post days in a week (ISO 1 = Monday) for 1–7 posts a week, spread out
const WEEKDAYS = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6], 7: [1, 2, 3, 4, 5, 6, 7] };
const ROTATION = ["tip", "service", "work", "tip", "review", "service", "team", "offer"];

// → [{post_on, theme, channel, occasion?}] for days in the month from `from` on, skipping days already planned
export function planMonth({ year, month, perWeek = 3, channels = ["google"], taken = [], from = null, hasWorks = true } = {}) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const want = new Set(WEEKDAYS[Math.max(1, Math.min(7, perWeek))]);
  const busy = new Set(taken);
  const out = [];
  let k = 0, c = 0;
  const chans = channels.length ? channels : ["google"];
  for (let d = 1; d <= days; d++) {
    const day = iso(year, month, d);
    if ((from && day < from) || busy.has(day)) continue;
    const occ = OCCASIONS[`${pad(month)}-${pad(d)}`];
    const wd = new Date(Date.UTC(year, month - 1, d)).getUTCDay() || 7;
    if (!occ && !want.has(wd)) continue;
    let theme = occ ? "occasion" : ROTATION[k++ % ROTATION.length];
    if (theme === "work" && !hasWorks) theme = "tip";
    out.push({ post_on: day, theme, channel: chans[c++ % chans.length], ...(occ ? { occasion: occ } : {}) });
  }
  return out;
}

const tags = (voice = {}, extra = []) => {
  const own = String(voice.hashtags || "").split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith("#") ? t : `#${t}`));
  return [...new Set([...own, ...extra])].slice(0, 6).join(" ");
};
const word = (s) => String(s || "").replace(/[^A-Za-z0-9]/g, "");

// a free first draft for a slot, in the firm's words (no AI)
export function templatePost({ theme, business = "our firm", city = "", service = "", work = null, occasion = "", voice = {} } = {}) {
  const where = city ? ` in ${city}` : "";
  const svc = service || "our services";
  const cta = voice.tone === "bold" ? "Call us today." : "Message us to know more.";
  const T = {
    tip: { title: `A quick tip about ${svc}`, body: `Quick tip from ${business}: plan ${svc.toLowerCase()} early — most delays and extra costs come from starting late. Need help? ${cta}` },
    service: { title: svc, body: `${business}${where} offers ${svc.toLowerCase()}. Clear scope, fair price and on-time delivery. ${cta}` },
    work: { title: work?.work_name ? `Completed: ${work.work_name}` : "Another job completed", body: work?.work_name ? `We recently completed ${work.work_name}${work.client ? ` for ${work.client}` : ""}. Thank you for the trust! ${cta}` : `Another job completed on time by the ${business} team. ${cta}` },
    review: { title: "Thank you", body: `A big thank you to every client who trusted ${business} this month. Your referrals keep us growing.` },
    team: { title: "Behind the scenes", body: `Behind every delivery at ${business} is a team that cares about the details. Here's to them!` },
    occasion: { title: occasion || "Greetings", body: `${business} wishes you a happy ${occasion || "day"}!` },
    offer: { title: `Talk to us about ${svc}`, body: `Looking for ${svc.toLowerCase()}${where}? ${business} is ready to help. ${cta}` },
  };
  const p = T[theme] || T.tip;
  return { title: p.title, body: p.body, hashtags: tags(voice, [`#${word(business)}`, city ? `#${word(city)}` : null].filter(Boolean)) };
}

// the AI prompt: public business information only (name, city, services, completed work titles, the brand voice)
export function aiPostPrompt({ theme, channel = "google", business, city, service, work, occasion, voice = {}, hint = "" } = {}) {
  const ch = CHANNELS[channel] || CHANNELS.google;
  return [
    `Write one ${ch.label} post for ${business}${city ? `, ${city}, India` : ""}.`,
    `Topic: ${THEMES[theme] || theme}${occasion ? ` — ${occasion}` : ""}${service ? `; service: ${service}` : ""}${work?.work_name ? `; completed work: ${work.work_name}` : ""}.`,
    hint ? `Extra direction: ${hint}.` : "",
    `Tone: ${TONES[voice.tone] || TONES.friendly}.${voice.audience ? ` Audience: ${voice.audience}.` : ""}${voice.about ? ` About the firm: ${voice.about}.` : ""}`,
    voice.say_words ? `Use words like: ${voice.say_words}.` : "", voice.avoid_words ? `Never use: ${voice.avoid_words}.` : "",
    `Language: ${(voice.languages || ["en"]).includes("hi") ? "simple English, a Hindi line is welcome" : "simple English"}. At most ${Math.min(ch.max, 600)} characters. No made-up numbers, prices, awards or client names.`,
    `Answer JSON only: {"title": "...", "body": "...", "hashtags": "#a #b"} with at most 5 hashtags.`,
  ].filter(Boolean).join("\n");
}
export function cleanAiPost(d, channel = "google") {
  if (!d || typeof d.body !== "string" || d.body.trim().length < 20) return null;
  const max = (CHANNELS[channel] || CHANNELS.google).max;
  return { title: String(d.title || "").trim().slice(0, 120), body: d.body.trim().slice(0, max), hashtags: String(d.hashtags || "").split(/\s+/).filter((t) => /^#\w+/.test(t)).slice(0, 5).join(" ") };
}

// text to copy, and a share link where the channel takes one
export function postText(p) { return [p.body, p.hashtags].filter(Boolean).join("\n\n"); }
export function shareLink(p) {
  const t = encodeURIComponent(postText(p));
  if (p.channel === "whatsapp") return `https://wa.me/?text=${t}`;
  if (p.channel === "linkedin") return `https://www.linkedin.com/feed/?shareActive=true&text=${t}`;
  if (p.channel === "x") return `https://x.com/intent/post?text=${t}`;
  return null;
}
export function tooLong(p) { const max = (CHANNELS[p.channel] || CHANNELS.google).max; const n = postText(p).length; return n > max ? n - max : 0; }

// calendar grid: weeks (Mon–Sun) of the month with the posts of each day
export function monthGrid(year, month, posts = []) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() || 7;
  const by = {};
  for (const p of posts) (by[p.post_on] ||= []).push(p);
  const cells = Array.from({ length: first - 1 }, () => null);
  for (let d = 1; d <= days; d++) { const day = iso(year, month, d); cells.push({ day, d, posts: by[day] || [], occasion: OCCASIONS[`${pad(month)}-${pad(d)}`] || null }); }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
