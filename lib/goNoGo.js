// Go / no-go (brief §3.7): one plain suggestion per tender from what Dhandha already knows — fit score, mandatory
// conditions, open questions, time left, your record with this buyer and the money tied up. Pure and tested.

// t: { score, unmet, pending, daysLeft, chance (0–100 | null), emd, value, readiness (0–100) }
export function goNoGo(t = {}) {
  const why = [];
  let pts = Number(t.score) || 0;
  if (t.unmet > 0) { pts -= 60; why.push(`${t.unmet} mandatory condition${t.unmet === 1 ? "" : "s"} not met`); }
  if (t.pending > 0) { pts -= 10; why.push(`${t.pending} question${t.pending === 1 ? "" : "s"} to answer`); }
  if (t.daysLeft != null) {
    if (t.daysLeft < 0) return { call: "closed", label: "Closed", tone: "mute", why: ["Bidding has closed"] };
    if (t.daysLeft < 3 && (t.readiness ?? 0) < 60) { pts -= 45; why.push(`only ${t.daysLeft} day${t.daysLeft === 1 ? "" : "s"} left`); }
  }
  if (t.chance != null) { pts += (t.chance - 30) / 2; why.push(`your record on similar bids: ${t.chance}% won`); }
  if (t.emd && t.value && t.emd / t.value > 0.05) why.push("EMD is high for the value");
  const call = pts >= 65 ? "go" : pts >= 40 ? "maybe" : "no";
  return { call, label: { go: "Go", maybe: "Think it over", no: "Probably skip" }[call], tone: { go: "ok", maybe: "warn", no: "bad" }[call], points: Math.round(pts), why };
}
