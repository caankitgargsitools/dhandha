// Work in hand (owner, map item 7; 12 Nov): how each won job is going — progress against the time gone, the latest
// site update, crew on site and open problems. Pure and tested.

const DAY = 86400000;

// { start, end, progress } → expected % by today, gap (progress − expected), tone and a plain label
export function scheduleStatus({ start, end, progress } = {}, now = new Date()) {
  const p = progress == null ? null : Number(progress);
  if (!start || !end) return { expected: null, gap: null, tone: p == null ? "mute" : "info", label: p == null ? "No update yet" : `${p}% done` };
  const s = new Date(start).getTime(), e = new Date(end).getTime() + DAY - 1;
  const span = Math.max(DAY, e - s);
  const expected = Math.max(0, Math.min(100, Math.round(((now - s) / span) * 100)));
  const daysLeft = Math.ceil((e - now) / DAY);
  if (p == null) return { expected, gap: null, tone: expected > 10 ? "warn" : "mute", label: expected > 10 ? "No update yet" : "Not started", daysLeft };
  const gap = p - expected;
  if (p >= 100) return { expected, gap, tone: "ok", label: "Work done — mark it completed", daysLeft };
  if (daysLeft < 0) return { expected, gap, tone: "bad", label: `${-daysLeft} day${daysLeft === -1 ? "" : "s"} past the end date at ${p}%`, daysLeft };
  if (gap <= -20) return { expected, gap, tone: "bad", label: `Behind: ${p}% done, ${expected}% of the time gone`, daysLeft };
  if (gap <= -8) return { expected, gap, tone: "warn", label: `A little behind: ${p}% vs ${expected}%`, daysLeft };
  return { expected, gap, tone: "ok", label: `On track: ${p}% done, ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`, daysLeft };
}

// tender jobs (won matches) and tracked deals → one list with their updates, newest first per job
export function jobList({ matches = [], deals = [], updates = [] } = {}, now = new Date()) {
  const by = new Map();
  for (const u of updates) {
    const k = u.match_id ? `m:${u.match_id}` : `d:${u.deal_id}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(u);
  }
  for (const list of by.values()) list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const rows = [
    ...matches.map((m) => ({ key: `m:${m.id}`, kind: "tender", id: m.id, title: m.tenders?.title || "Tender", client: m.tenders?.authority || "", value: Number(m.contract_value || m.quoted_price) || 0, start: m.work_start, end: m.work_end, ref: m.loa_no, href: `/app/tenders/${m.id}#after-award` })),
    ...deals.map((d) => ({ key: `d:${d.id}`, kind: "deal", id: d.id, title: d.title, client: d.leads?.name || "", value: Number(d.value_inr) || 0, start: d.work_start, end: d.work_end, ref: null, href: `/app/crm/${d.id}` })),
  ].map((j) => {
    const ups = by.get(j.key) || [];
    const last = ups.find((u) => u.progress != null);
    const latest = ups[0] || null;
    // a problem stays open until a later update without the problem flag is posted
    const openIssue = latest?.issue && !latest.archived_at ? latest : null;
    const st = scheduleStatus({ start: j.start, end: j.end, progress: last?.progress }, now);
    const quiet = latest ? Math.floor((now - new Date(latest.created_at)) / DAY) : null;
    return { ...j, updates: ups, latest, progress: last?.progress ?? null, crew: latest?.crew ?? null, status: st, issue: openIssue, quietDays: quiet };
  });
  const rank = { bad: 0, warn: 1, info: 2, mute: 3, ok: 4 };
  return rows.sort((a, b) => (a.issue ? -1 : 0) - (b.issue ? -1 : 0) || rank[a.status.tone] - rank[b.status.tone] || String(a.end || "9").localeCompare(String(b.end || "9")));
}

export function workSummary(rows = []) {
  return {
    jobs: rows.length,
    value: rows.reduce((a, r) => a + r.value, 0),
    behind: rows.filter((r) => r.status.tone === "bad").length,
    issues: rows.filter((r) => r.issue).length,
    crew: rows.reduce((a, r) => a + (Number(r.crew) || 0), 0),
    quiet: rows.filter((r) => r.quietDays == null || r.quietDays > 7).length,
  };
}
