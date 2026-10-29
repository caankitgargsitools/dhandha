// Lead Playbook: what happens to a lead, step by step, from the moment it arrives. Each step is one action (AI call,
// WhatsApp, email, booking link, a task for a person) after a wait, inside the playbook's office hours. Stored as a
// `sequences` row (trigger, office hours) with `sequence_steps` (channel, delay_minutes, config); the database worker
// (outreach_claim) runs them. Pure helpers here, shared by the builder page and its server action.

export const STEP_TYPES = {
  ai_call: { label: "AI call", icon: "🤖", hint: "An AI voice calls the lead with your script and talks in their language." },
  whatsapp: { label: "WhatsApp", icon: "💬", hint: "An approved WhatsApp template from your business number." },
  email: { label: "Email", icon: "✉️", hint: "An email from Dhandha's mail service with your reply-to address." },
  booking_link: { label: "Booking link", icon: "📅", hint: "A link where the lead picks a free time with your team." },
  task: { label: "Task for a person", icon: "📝", hint: "A reminder for the lead's owner — call, visit, send a quote…" },
};

export const LANGUAGES = { en: "English", hi: "Hindi", hinglish: "Hinglish (Hindi + English)" };
export const VOICES = { female: "Female", male: "Male" };
export const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [7, "Sun"]];
export const UNITS = { minutes: 1, hours: 60, days: 1440 };
export const MAX_STEPS = 50;
export const PLACEHOLDERS = "{name} {business} {city} {our_company}";

const str = (v, n) => String(v ?? "").trim().slice(0, n);
const time = (v, d) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || "")) ? String(v) : d);

// minutes ↔ the friendliest "N unit"
export function splitDelay(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m && m % 1440 === 0) return { amount: m / 1440, unit: "days" };
  if (m && m % 60 === 0) return { amount: m / 60, unit: "hours" };
  return { amount: m, unit: "minutes" };
}
export const delayMinutes = (amount, unit) => Math.min(Math.max(0, Math.round(Number(amount) || 0) * (UNITS[unit] || 1)), 90 * 1440);

export function delayText(min) {
  if (!min) return "straight away";
  const { amount, unit } = splitDelay(min);
  return `after ${amount} ${amount === 1 ? unit.replace(/s$/, "") : unit}`;
}

// One step from the builder → a `sequence_steps` row (without ids), or { error }.
export function normaliseStep(raw, i) {
  const type = String(raw?.type || "");
  if (!STEP_TYPES[type]) return { error: `Step ${i + 1}: choose what it does.` };
  const row = { step_no: i + 1, channel: type, day_offset: 0, delay_minutes: delayMinutes(raw.amount, raw.unit), subject: null, body: null, wa_template: null, wa_lang: "en", config: {} };
  const tpl = str(raw.wa_template, 512).toLowerCase();
  if (type === "ai_call") {
    const script = str(raw.script, 4000);
    if (script.length < 10) return { error: `Step ${i + 1}: write what the AI caller should say (the script).` };
    row.config = { script, goal: str(raw.goal, 300), language: LANGUAGES[raw.language] ? raw.language : "en", voice: VOICES[raw.voice] ? raw.voice : "female", match_language: raw.match_language !== false };
  } else if (type === "whatsapp") {
    if (!/^[a-z0-9_]{1,512}$/.test(tpl)) return { error: `Step ${i + 1}: enter the approved WhatsApp template name (small letters, numbers, _).` };
    row.wa_template = tpl; row.wa_lang = str(raw.wa_lang, 10) || "en";
  } else if (type === "email") {
    const subject = str(raw.subject, 200), body = str(raw.body, 5000);
    if (subject.length < 2 || body.length < 2) return { error: `Step ${i + 1}: write the email's subject and message.` };
    row.subject = subject; row.body = body;
  } else if (type === "booking_link") {
    const via = raw.send_via === "email" ? "email" : "whatsapp";
    if (via === "whatsapp" && !/^[a-z0-9_]{1,512}$/.test(tpl)) return { error: `Step ${i + 1}: enter the WhatsApp template that carries the link as {{3}}.` };
    row.config = { send_via: via, type_id: str(raw.type_id, 40) || null };
    if (via === "whatsapp") { row.wa_template = tpl; row.wa_lang = str(raw.wa_lang, 10) || "en"; }
    else { row.subject = str(raw.subject, 200) || null; row.body = str(raw.body, 5000) || null; }
  } else if (type === "task") {
    const title = str(raw.title, 200);
    if (title.length < 3) return { error: `Step ${i + 1}: write what the person should do.` };
    row.config = { title, details: str(raw.details, 2000) };
  }
  return { row };
}

// The whole builder form → { playbook, steps } ready to save, or { error }.
export function normalisePlaybook(raw) {
  const name = str(raw?.name, 120);
  if (name.length < 2) return { error: "Give the playbook a name." };
  const steps = Array.isArray(raw?.steps) ? raw.steps : [];
  if (!steps.length) return { error: "Add at least one step." };
  if (steps.length > MAX_STEPS) return { error: `At most ${MAX_STEPS} steps.` };
  const rows = [];
  for (const [i, s] of steps.entries()) { const r = normaliseStep(s, i); if (r.error) return r; rows.push(r.row); }
  const days = [...new Set((raw.office_days || []).map(Number).filter((d) => d >= 1 && d <= 7))].sort();
  const from = time(raw.office_from, "10:00"), to = time(raw.office_to, "19:00");
  if (days.length && from >= to) return { error: "Office hours: the closing time must be after the opening time." };
  const sources = [...new Set((raw.trigger_sources || []).map((x) => str(x, 40)).filter(Boolean))];
  return {
    playbook: { name, description: str(raw.description, 500) || null, trigger: raw.trigger === "new_lead" ? "new_lead" : "manual", trigger_sources: sources.length ? sources : null, office_from: from, office_to: to, office_days: days, active: raw.active !== false },
    steps: rows,
  };
}

// A saved step row → the builder's editable shape.
export function stepToForm(s) {
  const c = s.config || {};
  const { amount, unit } = splitDelay(s.delay_minutes ?? (s.day_offset || 0) * 1440);
  return { type: s.channel, amount, unit, script: c.script || "", goal: c.goal || "", language: c.language || "en", voice: c.voice || "female", match_language: c.match_language !== false,
    wa_template: s.wa_template || "", wa_lang: s.wa_lang || "en", subject: s.subject || "", body: s.body || "", send_via: c.send_via || "whatsapp", type_id: c.type_id || "", title: c.title || "", details: c.details || "" };
}

// One line per step, for lists ("🤖 AI call straight away → 💬 WhatsApp after 1 hour → …").
export const summary = (steps) => (steps || []).map((s) => `${STEP_TYPES[s.channel]?.icon || "•"} ${STEP_TYPES[s.channel]?.label || s.channel}`).join(" → ");

// A sensible first playbook for a new workspace.
export const STARTER = {
  name: "New lead — call, WhatsApp, email, meeting",
  trigger: "new_lead", office_from: "10:00", office_to: "19:00", office_days: [1, 2, 3, 4, 5, 6],
  steps: [
    { type: "ai_call", amount: 5, unit: "minutes", language: "hinglish", voice: "female", match_language: true, goal: "Find out if they need our services and offer a short meeting",
      script: "Namaste {name}, I am calling from {our_company}. We help businesses like {business} with audits, GST and tax compliance. Is this a good time to talk for two minutes?" },
    { type: "whatsapp", amount: 1, unit: "hours", wa_template: "", wa_lang: "en" },
    { type: "email", amount: 1, unit: "days", subject: "{our_company} — how we can help {business}", body: "Dear {name},\n\nThank you for your time. Here is a short note on how {our_company} can help {business}.\n\nRegards,\n{our_company}" },
    { type: "booking_link", amount: 2, unit: "days", send_via: "email" },
    { type: "task", amount: 4, unit: "days", title: "Call {name} at {business} to follow up" },
  ],
};
