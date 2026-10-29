// Learning from what a firm does with its matched tenders (pure, tested): each match remembers the keyword that
// matched it (matched_on). Words whose tenders the firm keeps skipping (or marking "not my work") and never takes up
// are offered as "stop showing" suggestions; words that bring work the firm takes up are its best words.

const TOOK = new Set(["shortlisted", "preparing", "submitted", "won", "lost"]);

export function feedbackOf(m = {}) {
  if (TOOK.has(m.status) || (m.ai_by === "you" && m.ai_fit === "yes")) return "took";
  if (m.status === "skipped" || (m.ai_by === "you" && m.ai_fit === "no")) return "dropped";
  return null;
}

export function wordStats(rows = []) {
  const by = new Map();
  for (const m of rows) {
    const f = feedbackOf(m);
    for (const w of new Set((m.matched_on || []).map((x) => String(x).toLowerCase().trim()).filter(Boolean))) {
      const s = by.get(w) || { word: w, took: 0, dropped: 0, seen: 0 };
      s.seen += 1;
      if (f) s[f] += 1;
      by.set(w, s);
    }
  }
  return [...by.values()];
}

// words to offer muting: dropped at least `min` times, never taken, and not already muted
export function muteSuggestions(rows = [], muted = [], min = 3) {
  const off = new Set(muted.map((w) => String(w).toLowerCase()));
  return wordStats(rows).filter((s) => s.dropped >= min && s.took === 0 && !off.has(s.word)).sort((a, b) => b.dropped - a.dropped).slice(0, 5);
}

export function bestWords(rows = [], min = 2) {
  return wordStats(rows).filter((s) => s.took >= min).sort((a, b) => b.took - a.took || a.dropped - b.dropped).slice(0, 5);
}
