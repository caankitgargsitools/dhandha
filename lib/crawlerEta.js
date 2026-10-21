// Time estimates for the live crawler window. Pure; tested in tests/crawlerEta.test.mjs.
export const DEFAULT_SECONDS = { tenders: 150, winners: 120 };

export function expectedSeconds(step, stats) {
  const s = stats[step];
  if (s?.avg_seconds) return Number(s.avg_seconds);
  return step.endsWith("winners") ? DEFAULT_SECONDS.winners : DEFAULT_SECONDS.tenders;
}

// How far a running step is: listing pages count for the first 30%, detail pages for the rest.
export function fraction(step, elapsed, expected) {
  if (step.phase === "details" && step.total > 0) return Math.min(0.99, 0.3 + 0.7 * (step.done / step.total));
  if (step.phase === "listing" && step.of > 0) return Math.min(0.3, 0.3 * ((step.page - 1) / step.of));
  return Math.min(0.95, expected ? elapsed / expected : 0);
}

// Seconds left for a running step: from its own progress when it has some, else from history.
export function remaining(step, elapsed, expected) {
  const f = fraction(step, elapsed, expected);
  if (f >= 0.35 && elapsed > 5) return Math.max(5, Math.round(elapsed / f - elapsed));
  return Math.max(5, Math.round(expected - elapsed));
}

// When each queued step should start, given the running ones and how many run side by side.
export function queueEta(running, queued, stats, concurrency = 2) {
  const lanes = running.map((r) => r.left).sort((a, b) => a - b);
  while (lanes.length < Math.max(1, concurrency)) lanes.push(0);
  return queued.map((q) => {
    lanes.sort((a, b) => a - b);
    const startsIn = lanes[0];
    lanes[0] = startsIn + expectedSeconds(q.step, stats);
    return { ...q, startsIn, expected: expectedSeconds(q.step, stats) };
  });
}

export const dur = (s) => {
  s = Math.max(0, Math.round(s));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  return m < 60 ? `${m}m ${String(r).padStart(2, "0")}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
