// Duplicate tenders across portals (brief §3.6): the same notice is often on CPPP and a state portal, or GeM and CPPP.
// Among one firm's matches, those with the same title (words), the same buyer words and closing within 48 hours are
// shown once, with "Also on: …" links. The best-scored copy (or the one already acted on) is kept. Pure and tested.

const key = (s) => String(s || "").toLowerCase().replace(/\(ref[^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter((w) => w.length > 2).slice(0, 14).join(" ");
const near = (a, b) => (a && b ? Math.abs(new Date(a) - new Date(b)) <= 48 * 3600000 : false);

// matches: [{id, status, score, tenders: {portal, title, authority, due_at, url, tender_ref}}] → same list without the
// extra copies; each kept match gets `also: [{id, portal, url, ref}]`
export function groupDuplicates(matches = []) {
  const acted = (m) => !["new", "skipped"].includes(m.status);
  const groups = new Map();
  for (const m of matches) {
    const t = m.tenders || {};
    const k = `${key(t.title)}|${key(t.authority).split(" ").slice(0, 3).join(" ")}`;
    if (!key(t.title)) { groups.set(`solo:${m.id}`, [m]); continue; }
    const g = groups.get(k);
    if (g && g.some((x) => near(x.tenders?.due_at, t.due_at) && x.tenders?.portal !== t.portal)) g.push(m);
    else if (g) groups.set(`${k}|${m.id}`, [m]);
    else groups.set(k, [m]);
  }
  const out = [];
  for (const g of groups.values()) {
    if (g.length === 1) { out.push(g[0]); continue; }
    const keep = [...g].sort((a, b) => Number(acted(b)) - Number(acted(a)) || (b.score || 0) - (a.score || 0))[0];
    out.push({ ...keep, also: g.filter((x) => x !== keep).map((x) => ({ id: x.id, portal: x.tenders?.portal, url: x.tenders?.url || null, ref: x.tenders?.tender_ref })) });
  }
  const order = new Map(matches.map((m, i) => [m.id, i]));
  return out.sort((a, b) => order.get(a.id) - order.get(b.id));
}
