import { test } from "node:test";
import assert from "node:assert/strict";
import { voicePrompt, normaliseTurn, lessonLines } from "../lib/voiceAgent.js";

test("prompt: introduces as Dhandha AI, fills the script, follows language settings", () => {
  const p = voicePrompt({ config: { company: "GSC & Associates", language: "hinglish", script: "Namaste {name}, {our_company} helps {business} with GST.", goal: "Offer a GST review", match_language: true },
    lead: { contact: "Ravi", name: "Ravi Traders", city: "Gurugram" }, history: [{ role: "ai", text: "Namaste" }, { role: "client", text: "Haan boliye" }], heard: "GST ka kaam hai" });
  assert.match(p, /I am Dhandha AI, calling from GSC & Associates/);
  assert.match(p, /Namaste Ravi, GSC & Associates helps Ravi Traders with GST/);
  assert.match(p, /Start in Hinglish/);
  assert.match(p, /switch to the same language/);
  assert.match(p, /Client just said: GST ka kaam hai/);
  assert.match(voicePrompt({ config: { match_language: false } }), /Stay in that language/);
});

test("turns are cleaned and limited", () => {
  assert.equal(normaliseTurn({ reply: "" }), null);
  const t = normaliseTurn({ reply: "**Namaste**, मैं Dhandha AI हूँ", end: false, outcome: "maybe" });
  assert.deepEqual(t, { reply: "Namaste, मैं Dhandha AI हूँ", lang: "hi", end: false, outcome: null, summary: null });
  const e = normaliseTurn({ reply: "Thank you, have a good day.", lang: "en", end: true, outcome: "interested", summary: "Wants a meeting Friday." });
  assert.equal(e.end, true); assert.equal(e.outcome, "interested"); assert.equal(e.summary, "Wants a meeting Friday.");
  assert.equal(normaliseTurn({ reply: Array(80).fill("word").join(" ") }).reply.split(" ").length, 60);
});

test("lessons go into the prompt", () => {
  const ls = [
    { kind: "rule", situation: "If the client is busy", better: "Ask for a good time to call back and end politely." },
    { kind: "example", situation: "the client asks the fee", bad: "Our fee is 5,000 rupees.", better: "Our team will send the exact fee on WhatsApp today." },
    { kind: "rule", better: "  " },
  ];
  assert.deepEqual(lessonLines(ls), [
    "- If the client is busy: Ask for a good time to call back and end politely.",
    '- When the client asks the fee: instead of "Our fee is 5,000 rupees.", say something like "Our team will send the exact fee on WhatsApp today."',
  ]);
  assert.match(voicePrompt({ lessons: ls }), /Lessons from earlier calls/);
  assert.doesNotMatch(voicePrompt({}), /Lessons from earlier calls/);
});
