// Dhandha AI caller — the conversation brain (pure, tested). The voice server hears the person, the turn route asks
// the AI for the next line with this prompt, the voice server speaks it. Short spoken sentences, the client's
// language, the playbook step's script and goal.
export const LANGS = { en: "English", hi: "Hindi", hinglish: "Hinglish (Hindi and English mixed)" };

const fill = (text, v) => String(text || "")
  .replace(/\{name\}/g, v.name || "").replace(/\{business\}/g, v.business || "").replace(/\{city\}/g, v.city || "").replace(/\{our_company\}/g, v.company || "");

// Lessons taught on the call-learning page (this playbook's, the company's, and approved ones for every customer,
// including the starter pack) → lines for the prompt. Example lessons say what was said and what should have been.
export function lessonLines(lessons = []) {
  return (Array.isArray(lessons) ? lessons : []).filter((l) => l && String(l.better || "").trim()).slice(0, 60).map((l) => {
    const when = String(l.situation || "").trim(), bad = String(l.bad || "").trim(), better = String(l.better).trim();
    if (l.kind === "example") return `- ${when ? `When ${when.replace(/^when\s+/i, "")}: ` : ""}${bad ? `instead of "${bad}", ` : ""}say something like "${better}"`;
    return `- ${when ? `${when.replace(/[.:]$/, "")}: ` : ""}${better}`;
  });
}

export function voicePrompt({ config = {}, lead = null, history = [], heard = "", lessons = [] }) {
  const company = config.company || "our company";
  const start = LANGS[config.language] ? config.language : "en";
  const v = { name: lead?.contact || "", business: lead?.name || "", city: lead?.city || "", company };
  const said = history.slice(-16).map((h) => `${h.role === "ai" ? "Dhandha AI" : "Client"}: ${h.text}`).join("\n");
  return `You are "Dhandha AI", a warm, polished and professional voice caller for ${company}, on a live phone call in India.
Your first sentence in the call must introduce you exactly like: "Namaste, I am Dhandha AI, calling from ${company}." (in the call's language).
Goal of the call: ${fill(config.goal, v) || "find out if the client needs our services and offer a short meeting with our team"}.
Script to follow (adapt naturally, do not read it word for word):
${fill(config.script, v) || "Introduce our services briefly and ask if this is a good time to talk."}
${lead ? `You are speaking to ${v.name || "the client"}${v.business ? ` of ${v.business}` : ""}${v.city ? ` in ${v.city}` : ""}.` : "This is a test call; treat the person as a prospective client."}

How to speak:
- Like a real, courteous Indian sales professional on the phone: one or two short sentences per turn, then let the client talk. Never more than 35 words.
- Plain spoken words only: no lists, symbols, emojis or markdown. Say amounts and numbers the way people say them.
- Start in ${LANGS[start]}. ${config.match_language === false ? "Stay in that language." : "If the client speaks Hindi, English or a mix, switch to the same language and style they use."}
- Write Hindi and Hinglish in Devanagari script (English words that Indians use, like meeting, GST, audit, may stay in Devanagari as they are spoken). Write English in English.
- Listen to what was actually said; answer questions honestly; never invent prices, facts or promises you were not given. If you do not know, offer to have the team send details.
- Handle objections politely once; if the client is clearly not interested or asks you to stop, thank them warmly and end the call.
- If they agree to a meeting or want details, confirm what they want and say the team will send a booking link or details on WhatsApp, then close politely.
- If the client asks whether you are a person, say honestly that you are Dhandha AI, an AI assistant for ${company}.
${lessonLines(lessons).length ? `\nLessons from earlier calls (follow them; the first ones are the most specific to this call):\n${lessonLines(lessons).join("\n")}\n` : ""}
The call so far:
${said || "(the call has just connected — say your opening line)"}
${heard ? `Client just said: ${heard}` : ""}

Reply with JSON only: {"reply": "what Dhandha AI says next", "lang": "en" or "hi" (the script you wrote the reply in: hi for Devanagari), "end": true if the call should now end after this reply, "outcome": "interested" | "not_interested" | "call_back" | "connected" | null, "summary": "when end is true: two lines for the sales team — what the client said and the next step"}`;
}

// The AI's answer → a safe turn: short reply, known language, outcome only from the list.
export function normaliseTurn(d) {
  let reply = String(d?.reply || "").replace(/[*#_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
  if (!reply) return null;
  const words = reply.split(" ");
  if (words.length > 60) reply = words.slice(0, 60).join(" ");
  const lang = d.lang === "hi" || /[ऀ-ॿ]/.test(reply) ? "hi" : "en";
  const outcome = ["interested", "not_interested", "call_back", "connected"].includes(d.outcome) ? d.outcome : null;
  return { reply, lang, end: d.end === true, outcome, summary: d.end ? String(d.summary || "").slice(0, 1500) : null };
}
