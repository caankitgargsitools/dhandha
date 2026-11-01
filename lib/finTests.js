// Railway / PSU / GeM money tests beyond average turnover (tender study F16, Q9 yes, 1 Nov 2026). Free and pure:
// `findFinTests(text)` reads what the tender asks — aggregate (cumulative) turnover, liquid assets / working capital /
// access to credit, net worth (positive, or a figure), profit in each year, "best 3 of 5 years" — and
// `checkFinTests(tests, facts, value)` checks it against the Vault's yearly facts (fin.turnover, fin.net_worth,
// fin.profit_after_tax per FY). A test the Vault cannot answer is "ask", never a rejection.

const WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, ten: 10 };
const toN = (s) => (s == null ? null : WORD[String(s).toLowerCase()] ?? Number(String(s).replace(/,/g, "")));
const UNITS = { crore: 1e7, crores: 1e7, cr: 1e7, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, million: 1e6 };
const money = (n, u) => Math.round(toN(n) * (UNITS[String(u || "").toLowerCase().replace(/\.$/, "")] || 1));
const AMT = String.raw`(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d+)?)\s*(crores?|cr\.?|lakhs?|lacs?|lac|million)?`;
const YEARS = String.raw`(?:last|preceding|past|immediately preceding)\s+(\d|one|two|three|four|five|seven|ten)\s+(?:audited\s+)?(?:financial\s+)?years`;

const flat = (text) => String(text || "").replace(/\s+/g, " ");

export function findFinTests(text) {
  const t = flat(text);
  const out = {};
  // aggregate / cumulative / total turnover over N years: "1.5 times", "150%", or an amount
  let m = t.match(new RegExp(String.raw`(?:aggregate|cumulative|total)\s+(?:annual\s+)?(?:financial\s+)?turnover[^.]{0,260}?(?:(\d+(?:\.\d+)?)\s*(?:t\s?i\s?m\s?e\s?s?|x)\b|(\d{2,3}(?:\.\d+)?)\s*%|${AMT})`, "i"));
  if (m) {
    const years = (m[0].match(new RegExp(YEARS, "i")) || t.slice(m.index, m.index + 400).match(new RegExp(YEARS, "i")) || [])[1];
    out.aggregate = { times: m[1] ? Number(m[1]) : m[2] ? Number(m[2]) / 100 : null, amount: m[3] ? money(m[3], m[4]) : null, years: toN(years) || 3, text: m[0].slice(0, 220) };
  }
  // liquid assets / working capital / access to lines of credit
  m = t.match(new RegExp(String.raw`(liquid assets|working capital|access to (?:or availability of )?(?:lines? of )?credit)[^.]{0,220}?(?:(\d{1,3}(?:\.\d+)?)\s*%|${AMT})`, "i"));
  if (m) out.liquid = { kind: m[1].toLowerCase(), pct: m[2] ? Number(m[2]) : null, amount: m[3] ? money(m[3], m[4]) : null, letter_months: toN((t.slice(m.index, m.index + 500).match(/(?:not older than|issued within|dated within|within)\s+(\d|one|two|three|six)\s+months/i) || [])[1]) || null, text: m[0].slice(0, 220) };
  // net worth
  m = t.match(/(?:positive\s+n\s?e\s?t[- ]?w\s?o\s?r\s?t\s?h|n\s?e\s?t[- ]?w\s?o\s?r\s?t\s?h\s*\(\s*\+\s*ve\s*\)|net[- ]?worth[^.]{0,80}?(?:should|shall|must) (?:be )?(?:positive|not be negative|not (?:have )?(?:been )?eroded))/i);
  const nw = t.match(new RegExp(String.raw`net[- ]?worth[^.]{0,120}?(?:not (?:be )?less than|no less than|minimum(?: of)?|at least|of)\s*${AMT}`, "i"));
  if (m || nw) out.net_worth = { positive: !!m, amount: nw ? money(nw[1], nw[2]) : null, years: toN(((m || nw)[0].match(new RegExp(YEARS, "i")) || t.slice((m || nw).index, (m || nw).index + 300).match(new RegExp(YEARS, "i")) || [])[1]) || (m ? 3 : 1), text: (m || nw)[0].slice(0, 220) };
  // profit in each year / no loss
  m = t.match(new RegExp(String.raw`(?:(?:net\s+)?profit(?:\s+after\s+tax)?\s+(?:in|during|for)\s+(?:each|all|every)\s+(?:of\s+)?(?:the\s+)?(?:${YEARS}|(\d|two|three|five)\s+years)|(?:not|never)\s+(?:have\s+)?(?:incurred|suffered|made)\s+(?:any\s+|a\s+|net\s+)?loss(?:es)?[^.]{0,80}?(?:${YEARS}|(\d|two|three|five)\s+years))`, "i"));
  if (m) out.profit = { years: toN(m[1] || m[2] || m[3] || m[4]) || 3, text: m[0].slice(0, 220) };
  // best N of M years
  m = t.match(/best\s+(\d|three|two|five)\s+(?:financial\s+)?(?:years\s+)?(?:out\s+)?of\s+(?:the\s+)?(?:last\s+)?(\d|five|seven|four)\s+(?:financial\s+)?years/i);
  if (m) out.best_of = { take: toN(m[1]), of: toN(m[2]), text: m[0] };
  return Object.keys(out).length ? out : null;
}

// facts: [{ key, period, value }] — newest year first after sorting by the period text ("FY 2024-25", "2024-25").
const series = (facts, key) => (facts || []).filter((f) => f.key === key && f.value != null && f.value !== "" && Number.isFinite(Number(f.value)))
  .sort((a, b) => String(b.period).localeCompare(String(a.period))).map((f) => ({ period: f.period, v: Number(f.value) }));
const rs = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} lakh` : `₹${Math.round(n).toLocaleString("en-IN")}`);

export function checkFinTests(tests, facts, value) {
  if (!tests) return [];
  const rows = [];
  const turnover = series(facts, "fin.turnover"), nw = series(facts, "fin.net_worth"), pat = series(facts, "fin.profit_after_tax");
  const v = Number(value) || 0;
  if (tests.aggregate) {
    const a = tests.aggregate, need = a.amount || (a.times && v ? a.times * v : null);
    const years = tests.best_of ? turnover.slice(0, tests.best_of.of).sort((x, y) => y.v - x.v).slice(0, tests.best_of.take) : turnover.slice(0, a.years);
    const have = years.reduce((s, y) => s + y.v, 0);
    const label = tests.best_of ? `Total turnover of the best ${tests.best_of.take} of ${tests.best_of.of} years` : `Total turnover of ${a.years} years`;
    if (!need) rows.push({ key: "aggregate", label, need: a.times ? `${a.times} × the estimate (not published)` : "as the tender says", have: years.length ? rs(have) : "—", state: "ask", note: "The estimate is not known; compare with the tender's figure." });
    else if (years.length < Math.min(a.years, tests.best_of?.take || a.years)) rows.push({ key: "aggregate", label, need: rs(need), have: years.length ? `${rs(have)} (${years.length} year${years.length === 1 ? "" : "s"} in the Vault)` : "—", state: have >= need ? "ok" : "ask", note: have >= need ? "" : "Add the missing years' turnover in Vault → Facts." });
    else rows.push({ key: "aggregate", label, need: rs(need), have: rs(have), state: have >= need ? "ok" : "bad", note: have >= need ? "" : `Short by ${rs(need - have)}.` });
  }
  if (tests.liquid) {
    const l = tests.liquid, need = l.amount || (l.pct && v ? (l.pct / 100) * v : null);
    rows.push({ key: "liquid", label: `${l.kind[0].toUpperCase()}${l.kind.slice(1)}`, need: need ? rs(need) : l.pct ? `${l.pct}% of the estimate` : "as the tender says", have: "Bank letter", state: "ask", note: `Get a bank letter / certificate${l.letter_months ? ` dated within ${l.letter_months} month${l.letter_months === 1 ? "" : "s"} of the closing date` : ""} showing at least this amount.` });
  }
  if (tests.net_worth) {
    const n = tests.net_worth, yrs = nw.slice(0, n.years);
    const label = n.amount ? `Net worth at least ${rs(n.amount)}` : `Positive net worth${n.years > 1 ? ` in each of ${n.years} years` : ""}`;
    if (!yrs.length) rows.push({ key: "net_worth", label, need: n.amount ? rs(n.amount) : "> 0", have: "—", state: "ask", note: "Add net worth per year in Vault → Facts (or upload the balance sheets)." });
    else {
      const ok = n.amount ? yrs[0].v >= n.amount : yrs.every((y) => y.v > 0);
      const short = !n.amount && yrs.length < n.years;
      rows.push({ key: "net_worth", label, need: n.amount ? rs(n.amount) : "> 0 every year", have: yrs.map((y) => `${y.period}: ${rs(y.v)}`).join(" · "), state: !ok ? "bad" : short ? "ask" : "ok", note: !ok ? "Not met in the Vault's figures." : short ? `Only ${yrs.length} year${yrs.length === 1 ? "" : "s"} in the Vault.` : "" });
    }
  }
  if (tests.profit) {
    const p = tests.profit, yrs = pat.slice(0, p.years);
    const label = `Profit in each of the last ${p.years} years`;
    if (!yrs.length) rows.push({ key: "profit", label, need: "> 0 every year", have: "—", state: "ask", note: "Add profit after tax per year in Vault → Facts (or upload the balance sheets)." });
    else {
      const loss = yrs.find((y) => y.v <= 0);
      rows.push({ key: "profit", label, need: "> 0 every year", have: yrs.map((y) => `${y.period}: ${rs(y.v)}`).join(" · "), state: loss ? "bad" : yrs.length < p.years ? "ask" : "ok", note: loss ? `Loss in ${loss.period}.` : yrs.length < p.years ? `Only ${yrs.length} year${yrs.length === 1 ? "" : "s"} in the Vault.` : "" });
    }
  }
  return rows;
}
