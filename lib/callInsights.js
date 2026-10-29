// After-call insights (pure, free, tested): the client's mood and objections read from a call transcript with word
// lists in English, Hindi and Hinglish — no AI needed, so it runs on every call at no cost. Used on Call learning:
// a mood chip and objection chips per call, and "Objections clients raise" across calls (how often, and how many of
// those calls still ended interested or with a call-back).

export const OBJECTIONS = {
  price: { label: "Too costly", rx: /\b(costly|expensive|too much|high price|price is high|budget|cheaper|discount|mehe?nga|mahanga|paisa nahi|paise nahi|kam karo|rate zyada)\b|महंगा|बजट|पैसे नहीं/i },
  busy: { label: "Busy / call later", rx: /\b(busy|call (me )?later|call back|in a meeting|driving|not now|abhi nahi|baad me(in)?|kal (call|baat)|free nahi)\b|बाद में|अभी नहीं|व्यस्त/i },
  not_needed: { label: "Don't need it", rx: /\b(not (interested|needed|required)|don'?t need|no need|no requirement|zaroorat nahi|zarurat nahi|nahi chahiye|interest nahi)\b|ज़रूरत नहीं|जरूरत नहीं|नहीं चाहिए/i },
  have_one: { label: "Already have someone", rx: /\b(already (have|using|working)|we have (a|our) (ca|vendor|agency|person|team)|existing (vendor|ca|consultant)|pehle se|already hai)\b|पहले से/i },
  send_details: { label: "Send details first", rx: /\b(send (me )?(the )?(details|brochure|info|information|profile|quotation|quote)|whatsapp (me|kar)|mail (me|kar)|details bhej)\b|डिटेल भेज|भेज दो/i },
  decider: { label: "Someone else decides", rx: /\b(boss|partner|owner|director|my (sir|manager)|management|not my decision|i will ask|discuss (with|internally)|puch(h)? ?k(e|ar))\b|पूछ कर|मालिक/i },
  trust: { label: "Who are you? / spam", rx: /\b(who (is this|are you)|how did you get my number|spam|fraud|don'?t call|stop calling|remove my number|aap kaun)\b|आप कौन|कॉल मत/i },
};

const POS = /\b(yes|sure|ok(ay)?|great|good|interested|tell me more|sounds good|please (send|share|call)|haan|ha+n ji|ji haan|theek hai|thik hai|achha|accha|zaroor|bilkul|batao|bataiye)\b|हाँ|ठीक है|ज़रूर|बिल्कुल|अच्छा/i;
const NEG = /\b(no|not interested|don'?t|stop|waste|irritat|angry|rubbish|nahi|mat|bakwas|pareshan)\b|नहीं|मत|बकवास/i;

export function objectionsIn(transcript = []) {
  const found = [];
  transcript.forEach((l, i) => {
    if (l.role !== "client" || !l.text) return;
    for (const [kind, o] of Object.entries(OBJECTIONS)) {
      if (o.rx.test(l.text) && !found.some((f) => f.kind === kind)) found.push({ kind, label: o.label, turn: i, text: l.text });
    }
  });
  return found;
}

// positive / neutral / negative from what the client said, how it ended and who hung up
export function moodOf(transcript = [], outcome, endedBy) {
  let s = 0;
  for (const l of transcript) {
    if (l.role !== "client" || !l.text) continue;
    if (POS.test(l.text)) s += 1;
    if (NEG.test(l.text)) s -= 1;
  }
  if (outcome === "interested") s += 2;
  if (outcome === "call_back") s += 1;
  if (outcome === "not_interested") s -= 2;
  if (endedBy === "client") s -= 1;
  return s >= 2 ? "positive" : s <= -2 ? "negative" : "neutral";
}

export const MOOD = { positive: "Warm", neutral: "Neutral", negative: "Cold" };

export function callInsights(call = {}) {
  const tr = call.transcript || [];
  const objections = objectionsIn(tr);
  const mood = moodOf(tr, call.outcome, call.ended_by);
  const said = tr.filter((l) => l.role === "client").length;
  const next = call.outcome === "interested" ? "Send what was promised and book a meeting"
    : call.outcome === "call_back" || objections.some((o) => o.kind === "busy") ? "Call back at the time they asked"
    : objections.some((o) => o.kind === "send_details") ? "Send details on WhatsApp, then follow up in 2 days"
    : objections.some((o) => o.kind === "trust") ? "Do not call again unless they reach out"
    : call.outcome === "not_interested" ? "Try again in 3 months" : "Follow up once more";
  const summary = !said ? "The client did not speak." :
    `${MOOD[mood]} call; the client spoke ${said} time${said === 1 ? "" : "s"}${objections.length ? ` and raised: ${objections.map((o) => o.label.toLowerCase()).join(", ")}` : ""}.`;
  return { mood, objections, next, summary };
}

// across calls: how often each objection comes up and how many of those calls still ended well
export function objectionStats(calls = []) {
  const by = {};
  for (const c of calls) {
    const good = c.outcome === "interested" || c.outcome === "call_back";
    for (const o of objectionsIn(c.transcript || [])) {
      const x = (by[o.kind] ||= { kind: o.kind, label: o.label, calls: 0, saved: 0, example: null });
      x.calls += 1; if (good) x.saved += 1;
      if (!x.example) x.example = { token: c.token, turn: o.turn, text: o.text };
    }
  }
  return Object.values(by).sort((a, b) => b.calls - a.calls);
}

// A tried answer for each objection, offered as a one-tap lesson when an objection keeps losing calls (the firm edits
// it before saving). Short, polite, never pushy — Hinglish-friendly wording works in Hindi and English calls.
export const ANSWERS = {
  price: "Understood — budget matters. Many clients start with a smaller scope first; may I share the starting option and send the details on WhatsApp?",
  busy: "No problem at all. What time suits you better today or tomorrow? I will call exactly then.",
  not_needed: "Thank you for telling me. Just so I can note it correctly — is it not needed right now, or not at all? If later, when should we check back?",
  have_one: "That is good to hear. Many of our clients also had someone; they keep us as a second option for quick or extra work. May I send our details for your records?",
  send_details: "Sure, I will send them on WhatsApp right now. So that I send the right ones — which part interests you most?",
  decider: "Of course. Who usually takes this decision? I can send a short note you can forward, or set up a quick call with both of you.",
  trust: "Sorry for calling unexpectedly — I am an AI assistant calling for the company I named, about their services for businesses like yours. If you prefer, we will not call again; just say so.",
};

// objections that keep losing calls (2+ calls, under half still went well) and have no lesson yet
export function lessonSuggestions(stats = [], lessons = []) {
  const have = lessons.filter((l) => l.status !== "retired").map((l) => String(l.situation || "").toLowerCase());
  return stats.filter((o) => o.calls >= 2 && o.saved / o.calls < 0.5 && ANSWERS[o.kind] && !have.some((s) => s.includes(o.label.toLowerCase())))
    .map((o) => ({ kind: o.kind, situation: `the client says: ${o.label.toLowerCase()}`, better: ANSWERS[o.kind], calls: o.calls, saved: o.saved }));
}
