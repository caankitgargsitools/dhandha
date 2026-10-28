// Call learning (pure, tested): which Dhandha AI lines keep clients talking and which lose them, read from what the
// client did next. Each transcript line is { role: "ai" | "client", text, at, interrupted }; a call also carries its
// outcome (interested / call_back / not_interested / connected) and who ended it (ai | client).
const GOOD = new Set(["interested", "call_back"]);
export const FEW = 20; // below this many uses a line's numbers are only a hint

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The same line said to different clients → one key: names, company and numbers become placeholders.
export function lineKey(text, vars = {}) {
  let t = String(text || "").toLowerCase();
  for (const [k, v] of Object.entries(vars)) {
    const val = String(v || "").trim().toLowerCase();
    if (val.length >= 3) t = t.replace(new RegExp(esc(val), "g"), `{${k}}`);
  }
  return t.replace(/\d[\d,.]*/g, "#").replace(/[^\p{L}\p{M}{}#\s]/gu, " ").replace(/\s+/g, " ").trim();
}

const varsOf = (c) => ({ company: c.config?.company, business: c.lead_name, name: c.contact });

export function lineStats(calls = []) {
  const by = new Map();
  for (const c of calls) {
    const tr = Array.isArray(c.transcript) ? c.transcript : [];
    const lastAi = tr.map((l) => l.role).lastIndexOf("ai");
    tr.forEach((l, i) => {
      if (l.role !== "ai" || !String(l.text || "").trim()) return;
      const key = lineKey(l.text, varsOf(c));
      if (!key) return;
      const g = by.get(key) || { key, text: l.text, said: 0, replied: 0, interrupted: 0, hungUp: 0, good: 0, bad: 0, turns: 0, example: null };
      g.said++;
      g.turns += tr.slice(0, i).filter((x) => x.role === "ai").length + 1;
      if (tr[i + 1]?.role === "client") g.replied++;
      if (l.interrupted) g.interrupted++;
      if (i === lastAi && c.ended_by === "client") { g.hungUp++; g.example = g.example || { token: c.token, turn: i }; }
      if (GOOD.has(c.outcome)) g.good++;
      if (c.outcome === "not_interested") g.bad++;
      if (!g.example && (l.interrupted || c.outcome === "not_interested")) g.example = { token: c.token, turn: i };
      if (!g.sample) g.sample = { token: c.token, turn: i };
      by.set(key, g);
    });
  }
  const lines = [...by.values()].map((g) => {
    const r = (n) => n / g.said;
    // liked: the client answered and calls went well; disliked: they cut in, said no, or hung up right after it
    const score = Math.round((r(g.replied) + 2 * r(g.good) - 3 * r(g.hungUp) - r(g.interrupted) - r(g.bad)) * 100) / 100;
    return { ...g, turn: Math.round(g.turns / g.said), score, hungUpRate: r(g.hungUp), interruptRate: r(g.interrupted), goodRate: r(g.good), few: g.said < FEW };
  });
  const sorted = [...lines].sort((a, b) => b.score - a.score || b.said - a.said);
  return {
    lines,
    best: sorted.filter((l) => l.score > 0).slice(0, 10),
    worst: [...sorted].reverse().filter((l) => l.score < 0.5).slice(0, 10),
    exits: lines.filter((l) => l.hungUp).sort((a, b) => b.hungUp - a.hungUp || b.hungUpRate - a.hungUpRate).slice(0, 10),
  };
}

// How far calls get: how many reach Dhandha AI's 1st, 2nd … line, and how they end.
export function callFunnel(calls = []) {
  const reach = [];
  const outcomes = {};
  let secs = 0, timed = 0, hungUp = 0;
  for (const c of calls) {
    const n = (c.transcript || []).filter((l) => l.role === "ai").length;
    for (let i = 0; i < Math.min(n, 10); i++) reach[i] = (reach[i] || 0) + 1;
    const o = c.outcome || "no result";
    outcomes[o] = (outcomes[o] || 0) + 1;
    if (c.ended_by === "client") hungUp++;
    if (c.started_at && c.ended_at) { secs += (new Date(c.ended_at) - new Date(c.started_at)) / 1000; timed++; }
  }
  return { calls: calls.length, reach, outcomes, hungUp, avgSeconds: timed ? Math.round(secs / timed) : 0 };
}

// Replaying one Dhandha AI line: the conversation before it, what the client had just said, and the original line.
export function replayContext(transcript = [], idx) {
  const line = transcript[idx];
  if (!line || line.role !== "ai") return null;
  const prev = transcript[idx - 1];
  const strip = (l) => ({ role: l.role, text: l.text });
  if (prev?.role === "client") return { history: transcript.slice(0, idx - 1).map(strip), heard: prev.text, original: line.text };
  return { history: transcript.slice(0, idx).map(strip), heard: "", original: line.text };
}
