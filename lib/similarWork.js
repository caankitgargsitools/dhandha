// "Similar work" (brief §2.7 — the most common reason bids are rejected): rank the firm's completed works against the
// tender's own definition of similar work and its value tests (one work ≥ A, or two ≥ B, or three ≥ C, in the last N
// years — the CPWD pattern). Free, pure and tested.

const STOP = new Set("the of and for in to a an or with by on at from as be is are work works similar nature completed executed during last years year government semi any one two three each value not less than rs crore lakh at least minimum shall should must bidder having".split(" "));
const stem = (w) => w.replace(/(ings|ing|ies|es|s|ed)$/, "");
const words = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));

// how well one work matches the definition (0–1): share of the definition's words found in the work's name / scope / category
export function workFit(definition, w) {
  const want = words(definition);
  if (!want.size) return 0;
  const have = words(`${w.work_name || ""} ${w.scope || ""} ${w.category || ""} ${w.client || ""}`);
  let hit = 0;
  for (const x of want) if (have.has(x)) hit++;
  return Math.round((hit / want.size) * 100) / 100;
}

const yearsAgo = (d, now) => (d ? (now - new Date(d)) / 31557600000 : Infinity);

// fields: { similar_work_definition, req_similar_one, req_similar_two, req_similar_three, req_similar_years }
// → { best: [{work, fit, value}], tests: [{label, need, have, ok}], ok, gap }
export function similarWorks(fields = {}, works = [], now = new Date()) {
  const def = fields.similar_work_definition || "";
  const years = Number(fields.req_similar_years) || 7;
  const done = (works || []).filter((w) => w.status !== "ongoing" && yearsAgo(w.end_date, now) <= years);
  const ranked = done.map((w) => ({ work: w, fit: def ? workFit(def, w) : null, value: Number(w.value_inr) || 0 }))
    .filter((x) => x.fit === null || x.fit >= 0.2)
    .sort((a, b) => (b.fit ?? 0) - (a.fit ?? 0) || b.value - a.value);
  const tests = [];
  const need = [[1, fields.req_similar_one], [2, fields.req_similar_two], [3, fields.req_similar_three]].filter(([, v]) => Number(v) > 0);
  for (const [k, v] of need) {
    const have = ranked.filter((x) => x.value >= Number(v)).length;
    tests.push({ label: `${k === 1 ? "One" : k === 2 ? "Two" : "Three"} similar work${k > 1 ? "s" : ""} of at least ₹${Math.round(Number(v)).toLocaleString("en-IN")}`, need: k, have, ok: have >= k });
  }
  const ok = tests.length ? tests.some((t) => t.ok) : null;
  let gap = null;
  if (tests.length && !ok) {
    const t = tests[0];
    gap = ranked.length ? `Your closest: ${ranked[0].work.work_name} (₹${ranked[0].value.toLocaleString("en-IN")}). Add any missing work with its value in Vault → Experience, or ask for a relaxation in the pre-bid queries.` : "No completed similar work in the last " + years + " years in your Vault. Add them in Vault → Experience.";
  }
  return { definition: def || null, years, best: ranked.slice(0, 3), tests, ok, gap };
}
