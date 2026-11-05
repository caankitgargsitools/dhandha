// Deadline cockpit (brief §3.1): how ready each bid in hand is, and how much time is left. Pure and tested.

const BLANK = /\[TO BE FILLED:/i;

// match: { status, quoted_price, filled_formats }, reads: tender_reads engines for the tender, signoffs: [{step, decision,
// created_at}], packs: [{kind}]  →  { steps: [{key, label, done}], done, total, pct }
export function readiness({ match = {}, readEngines = [], signoffs = [], packs = [] } = {}) {
  const formats = (match.filled_formats || []).filter((f) => f.kind !== "skip" && !f.reference);
  const formatsDone = formats.length > 0 && formats.every((f) => {
    const text = f.edited_text || f.filled_text || "";
    return f.reviewed || (text && !BLANK.test(text)) || (f.kind !== "custom" && f.kind !== "manual" && !BLANK.test(text));
  });
  const latest = {};
  for (const s of [...signoffs].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) latest[s.step] = s.decision;
  const signed = ["technical", "finance", "management"].every((k) => latest[k] === "approved");
  const steps = [
    { key: "read", label: "Tender read", done: readEngines.some((e) => e && e !== "precheck") },
    { key: "formats", label: "Formats filled", done: formatsDone },
    { key: "price", label: "Price set", done: Number(match.quoted_price) > 0 },
    { key: "signoff", label: "Sign-offs", done: signed },
    { key: "pack", label: "Signed bid file", done: packs.some((p) => p.kind === "final") },
  ];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, pct: Math.round((done / steps.length) * 100), next: steps.find((s) => !s.done)?.label || null };
}

// "2 d 4 h", "5 h 10 m", "closed" — and how urgent (red under 48 h, amber under 5 days)
export function timeLeft(dueAt, now = new Date()) {
  if (!dueAt) return { text: "Closing date not known", tone: "mute", hours: null };
  const ms = new Date(dueAt) - now;
  if (ms <= 0) return { text: "Closed", tone: "mute", hours: 0 };
  const h = ms / 3600000, d = Math.floor(h / 24), hh = Math.floor(h % 24), mm = Math.floor((ms % 3600000) / 60000);
  return { text: d ? `${d} d ${hh} h` : hh ? `${hh} h ${mm} m` : `${mm} m`, tone: h < 48 ? "bad" : h < 120 ? "warn" : "info", hours: Math.round(h * 10) / 10 };
}
