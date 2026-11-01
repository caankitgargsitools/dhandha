// Points tables (Q4 yes, 1 Nov 2026; tender study F6). GeM prints a QCBS / technical table as
// "Parameter Name Max Marks Cutoff Marks … <parameter> <max> <cutoff> View File …", then "Total Qualifying Marks … N"
// and "QCBS Weightage(Technical:Financial):70:30". The slabs (how many marks for how many partners…) sit in the buyer's
// file, so Dhandha shows each parameter with the firm's own figure from the Vault, and flags what is missing. Pure, tested.

const flat = (t) => String(t || "").replace(/[ऀ-ॿ\u0001-\u0008\u000B\u000E-\u001F]+/g, " ").replace(/\s+/g, " ");

export function parsePointsTable(text) {
  const t = flat(text);
  const head = t.search(/Parameter Name\s+Max(?:imum)?\.?\s+Marks\s+(?:Cutoff|Min(?:imum)?|Cut-off)\s+Marks/i);
  if (head < 0) return null;
  const body = t.slice(head, head + 4000).replace(/^Parameter Name\s+Max(?:imum)?\.?\s+Marks\s+\S+\s+Marks\s+(?:Qualification\s+Methodology\s+|Evaluation\s+)?(?:Document(?:\s+Seller Document Required)?\s+)?/i, "");
  const end = body.search(/(?:Buyer Defined\s+)?Total (?:Minimum Passing |Qualifying )?(?:Technical )?Marks|Pre Bid Detail|QCBS Weightage/i);
  const rows = [];
  const re = /(.+?)\s+(\d{1,3})\s+(\d{1,3})\s+View File\s*(?:Yes|No)?\s*/gi;
  let m;
  const part = end > 0 ? body.slice(0, end) : body;
  while ((m = re.exec(part)) && rows.length < 20) rows.push({ name: m[1].trim().replace(/^(?:Yes|No)\s+/i, ""), max: Number(m[2]), cutoff: Number(m[3]) });
  if (!rows.length) return null;
  const qual = Number((t.slice(head).match(/Total (?:Minimum Passing |Qualifying )?(?:Technical )?Marks[^:]*:\s*(\d{1,3})/i) || [])[1]) || null;
  const w = t.match(/QCBS Weightage\s*\(Technical\s*:\s*Financial\)\s*:?\s*(\d{1,3})\s*:\s*(\d{1,3})/i);
  const method = /Quality\s*&\s*Cost Based Selection|QCBS/i.test(t) ? "QCBS" : /Least Cost|LCS/i.test(t) ? "LCS" : null;
  return { method, rows, qualifying: qual, tech_weight: w ? Number(w[1]) : null, fin_weight: w ? Number(w[2]) : null };
}

// What each parameter is about, and where its figure lives in the Vault.
const KINDS = [
  ["disa", /CISA|DISA/i, "cred.disa_cisa", "DISA / CISA holders"],
  ["partners", /partners?/i, "cred.partners", "Partners"],
  ["cas", /chartered accountants?|\bCAs?\b|C\.A\./i, "cred.ca_count", "Chartered accountants"],
  ["staff", /staff|employees|manpower|semi[- ]qualified/i, "cred.audit_staff", "Staff"],
  ["years", /years? of (?:existence|establishment)|standing|establishment|existence|constitution|vintage/i, "cred.firm_years", "Years since set up"],
  ["turnover", /turn ?over/i, "fin.turnover", "Average turnover (3 years)"],
  ["office", /office|branch|located/i, "presence", "Office in the state"],
  ["works", /experience|assignments?|audits? (?:of|in|conducted)|clients|projects|work orders?/i, "works", "Similar works in Experience"],
];
export const kindOf = (name) => KINDS.find(([, re]) => re.test(name)) || null;

// vault: { facts: [{key, period, value}], works: number, incorporated: 'YYYY-MM-DD' | null }
export function pointsRows(table, vault = {}) {
  if (!table) return [];
  const facts = vault.facts || [];
  const fact = (k) => facts.find((f) => f.key === k)?.value;
  const rs = (n) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(2)} lakh`);
  return table.rows.map((r) => {
    const k = kindOf(r.name);
    let have = null;
    if (k) {
      const [kind, , key] = k;
      if (kind === "turnover") {
        const ys = facts.filter((f) => f.key === "fin.turnover" && Number(f.value) > 0).sort((a, b) => String(b.period).localeCompare(String(a.period))).slice(0, 3);
        if (ys.length) have = `${rs(ys.reduce((s, y) => s + Number(y.value), 0) / ys.length)} (${ys.length} yr)`;
      } else if (kind === "works") have = vault.works ? `${vault.works} completed` : null;
      else if (kind === "office") {
        const yes = facts.filter((f) => f.key.startsWith("presence.office.") && f.value === "yes").map((f) => f.key.slice(16).replace(/_/g, " "));
        have = yes.length ? `Yes: ${yes.join(", ")}` : null;
      } else if (kind === "years") {
        const v = fact(key) || (vault.incorporated ? String(Math.floor((Date.now() - new Date(vault.incorporated)) / 3.15576e10)) : null);
        have = v != null ? `${v} years` : null;
      } else { const v = fact(key); have = v != null ? String(v) : null; }
    }
    return { name: r.name, max: r.max, cutoff: r.cutoff, about: k?.[3] || null, have, state: have ? "ok" : k ? "ask" : "other" };
  });
}
