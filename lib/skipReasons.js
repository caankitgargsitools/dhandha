// Why a tender was dropped (brief §3.7): a short list, so the matching and the AI check learn the real reason.
export const SKIP_REASONS = [
  ["not_our_work", "Not our kind of work"],
  ["eligibility", "We can't meet the eligibility"],
  ["size", "Too small / too big for us"],
  ["location", "Too far / wrong state"],
  ["time", "Too little time to prepare"],
  ["price", "Price will be too tight"],
  ["other", "Other"],
];
export const skipLabel = (k) => SKIP_REASONS.find(([x]) => x === k)?.[1] || null;
