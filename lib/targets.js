// Sales targets, forecast and leaderboard (pure, tested). Rows come from SQL team_month: per person what they won,
// opened, met and logged this month, their open pipeline by stage, and the target their manager set.

// chance a deal at this stage is won — used for the weighted forecast
export const STAGE_PROB = { new: 0.05, contacted: 0.1, called: 0.15, qualified: 0.25, link_sent: 0.3, meeting: 0.4, proposal: 0.6, negotiation: 0.8 };

export const weighted = (byStage = {}) => Object.entries(byStage).reduce((s, [st, v]) => s + (Number(v) || 0) * (STAGE_PROB[st] ?? 0), 0);

export const pct = (actual, target) => (Number(target) > 0 ? Math.round((Number(actual || 0) / Number(target)) * 100) : null);

// how far through the month we are (India time), 0–1
export function monthProgress(month, now = new Date()) {
  const [y, m] = String(month).slice(0, 7).split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1) - 330 * 60000, end = Date.UTC(y, m, 1) - 330 * 60000;
  return Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
}

// each person: actuals, targets, % done, forecast (won + weighted open), on-track flag; ranked by points
export function leaderboard(rows = [], month, now = new Date()) {
  const progress = monthProgress(month, now);
  const people = rows.map((r) => {
    const won = Number(r.won_value) || 0;
    const fc = Math.round(won + weighted(r.open_by_stage));
    const p = {
      won: pct(won, r.t_won), meetings: pct(r.meetings, r.t_meetings), activities: pct(r.activities, r.t_activities), deals: pct(r.new_deals, r.t_deals),
    };
    const set = Object.values(p).filter((x) => x !== null);
    const score = set.length ? Math.round(set.reduce((a, b) => a + Math.min(b, 150), 0) / set.length) : null;
    // points when no target is set: ₹1 lakh won = 10, a meeting = 3, a new deal = 2, an activity = 1
    const points = Math.round(won / 1e4) + 3 * (r.meetings || 0) + 2 * (r.new_deals || 0) + (r.activities || 0);
    return { ...r, forecast: fc, pct: p, score, points,
      onTrack: score === null ? null : score >= Math.round(progress * 100) - 10,
      forecastPct: pct(fc, r.t_won) };
  });
  return people.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || b.points - a.points);
}

export function teamTotals(people = []) {
  const sum = (k) => people.reduce((s, p) => s + (Number(p[k]) || 0), 0);
  return { won: sum("won_value"), target: sum("t_won"), forecast: sum("forecast"), meetings: sum("meetings"), activities: sum("activities"), deals: sum("new_deals") };
}
