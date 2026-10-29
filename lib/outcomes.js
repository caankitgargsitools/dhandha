// Bid outcome register (C37; pure, tested): what happened to each bid we filed — technically qualified or not (and
// why), our rank, our price against L1 — and the win rate by department, state and kind of work, so a firm sees
// where it wins and why it loses. Rows from SQL bid_outcomes.

export const STAGES = { tech_qualified: "Technically qualified", tech_disqualified: "Disqualified (technical)", fin_opened: "Prices opened", awarded: "Awarded to us", cancelled: "Tender cancelled" };

// how far above L1 we were, in % of L1 (0 when we were L1)
export function gapPct(quoted, l1) {
  const q = Number(quoted), l = Number(l1);
  if (!(q > 0) || !(l > 0)) return null;
  return Math.round(((q - l) / l) * 1000) / 10;
}

const decided = (r) => r.status === "won" || r.status === "lost";

function rate(rows) {
  const d = rows.filter(decided), won = d.filter((r) => r.status === "won").length;
  return { bids: rows.length, decided: d.length, won, lost: d.length - won, winRate: d.length ? Math.round((won / d.length) * 100) : null };
}

export function outcomeStats(rows = []) {
  const all = rate(rows);
  const dq = rows.filter((r) => r.result_stage === "tech_disqualified");
  const reasons = {};
  for (const r of dq) { const k = String(r.result_reason || "No reason recorded").trim().toLowerCase(); reasons[k] = (reasons[k] || 0) + 1; }
  const gaps = rows.filter((r) => r.status === "lost" && r.result_stage !== "tech_disqualified").map((r) => gapPct(r.quoted_price, r.l1_price)).filter((g) => g !== null && g > 0).sort((a, b) => a - b);
  const by = (field) => {
    const groups = {};
    for (const r of rows) { const k = r[field] || "—"; (groups[k] ||= []).push(r); }
    return Object.entries(groups).map(([key, xs]) => ({ key, ...rate(xs) })).sort((a, b) => b.bids - a.bids).slice(0, 8);
  };
  return {
    ...all, disqualified: dq.length,
    reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([reason, n]) => ({ reason, n })),
    lostOnPrice: gaps.length, medianGap: gaps.length ? gaps[Math.floor((gaps.length - 1) / 2)] : null,
    byAuthority: by("authority"), byState: by("state"), byPack: by("industry_pack"),
  };
}
