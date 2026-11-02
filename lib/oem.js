// Resellers' brands and supplies (tender study F18, Q10 yes, 1 Nov 2026). Kept as Vault facts so nothing new is needed
// in the database: `oem.<brand>` (value JSON {brand, products, auth_no}; valid_until = authorisation valid till) and
// `supply.<product>` per FY (value JSON {product, qty, unit, buyer}). `oemCheck` turns a GeM bid's OEM-authorisation and
// past-performance tests into ok / bad / ask rows. Pure and tested.

export const slugKey = (s) => String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
const json = (v) => { try { const o = JSON.parse(v); return o && typeof o === "object" ? o : null; } catch { return null; } };

export const oemsFrom = (facts = []) => facts.filter((f) => f.key?.startsWith("oem.")).map((f) => ({ id: f.id, key: f.key, valid_until: f.valid_until || null, ...(json(f.value) || { brand: f.value }) })).filter((o) => o.brand);
export const suppliesFrom = (facts = []) => facts.filter((f) => f.key?.startsWith("supply.")).map((f) => ({ id: f.id, key: f.key, period: f.period || "", ...(json(f.value) || {}) })).filter((s) => s.product && Number(s.qty) > 0);

const STOP = new Set(["supply", "of", "and", "the", "for", "with", "to", "in", "a", "an", "items", "item", "bid", "gem", "set", "nos", "type", "make"]);
const words = (s) => new Set(String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(es|s)$/, "")));
const overlap = (a, b) => { const A = words(a), B = words(b); let n = 0; for (const w of A) if (B.has(w)) n++; return n; };

// Q35 (2 Nov): product certificates a bid can ask for, ticked per brand ({certs: [...keys]})
export const PRODUCT_CERTS = [
  { key: "bis_crs", label: "BIS registration (CRS)", re: /\bBIS\b|\bCRS\b|Compulsory Registration Scheme|IS\s?\d{3,5}\b/ },
  { key: "epr", label: "EPR registration (e-waste / plastic / battery)", re: /\bEPR\b|Extended Producer Responsibility/i },
  { key: "stqc", label: "STQC certificate", re: /\bSTQC\b/ },
  { key: "eol", label: "Not end-of-life / end-of-support for the warranty period", re: /end[- ]of[- ](?:life|sale|support)|\bEo[LS]\b/ },
  { key: "bee", label: "BEE star label", re: /\bBEE\b|star rat(?:ing|ed)|star label/i },
];

// the latest three FYs present in the facts count as "the last 3 years" (periods like "FY 2024-25" sort by text)
export function oemCheck({ gem, title = "", oems = [], supplies = [], dueAt = null } = {}) {
  if (!gem) return [];
  const rows = [];
  const needsOem = /OEM Authori[sz]ation/i.test(gem.documents_required || "") || gem.oem_turnover_lakh > 0;
  if (needsOem) {
    const fit = oems.map((o) => ({ o, n: overlap(`${o.brand} ${o.products || ""}`, title) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    const best = fit[0]?.o;
    const expired = best?.valid_until && dueAt && new Date(best.valid_until) < new Date(dueAt);
    rows.push(best
      ? { key: "oem", label: "OEM authorisation", need: "Authorisation from the maker (OEM)", have: `${best.brand}${best.auth_no ? ` · ${best.auth_no}` : ""}${best.valid_until ? ` · valid till ${String(best.valid_until).slice(0, 10)}` : ""}`, state: expired ? "bad" : "ok", note: expired ? "Expires before the bid closes — ask the OEM for a fresh one." : gem.oem_turnover_lakh ? `Also keep the OEM's turnover certificate (at least ₹${gem.oem_turnover_lakh} lakh).` : "" }
      : { key: "oem", label: "OEM authorisation", need: "Authorisation from the maker (OEM)", have: oems.length ? "None of your brands matches this bid" : "—", state: "ask", note: "Add the brand you will offer in Vault → Brands & supplies, with its authorisation." });
  }
  // product certificates the bid asks for, checked against the brand that fits the bid best
  const asked = PRODUCT_CERTS.filter((c) => c.re.test(`${gem.documents_required || ""} ${gem.atc_text || ""}`));
  if (asked.length) {
    const fit = oems.map((o) => ({ o, n: overlap(`${o.brand} ${o.products || ""}`, title) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n)[0]?.o;
    for (const c of asked) {
      const has = fit && (fit.certs || []).includes(c.key);
      rows.push({ key: `cert_${c.key}`, label: c.label, need: "Asked in this bid", have: !fit ? "—" : has ? `${fit.brand}: yes` : `${fit.brand}: not recorded`, state: has ? "ok" : "ask", note: has ? "Upload the certificate with the bid." : "Tick it on the brand in Vault → Brands & supplies once the OEM gives it." });
    }
  }
  if (gem.past_performance_pct && gem.total_qty) {
    const need = Math.ceil(gem.past_performance_pct / 100 * gem.total_qty);
    const years = [...new Set(supplies.map((s) => s.period))].sort().reverse().slice(0, 3);
    const fit = supplies.filter((s) => years.includes(s.period) && overlap(s.product, title) > 0).sort((a, b) => b.qty - a.qty);
    const best = fit[0];
    rows.push({ key: "past", label: `Past performance (${gem.past_performance_pct}% of ${gem.total_qty.toLocaleString("en-IN")})`, need: `${need.toLocaleString("en-IN")} in one of the last 3 years, to government / PSU`, have: best ? `${best.product}: ${Number(best.qty).toLocaleString("en-IN")} ${best.unit || ""} (${best.period})` : "—", state: !best ? "ask" : best.qty >= need ? "ok" : "bad", note: !best ? "Add how much of this product you supplied each year in Vault → Brands & supplies, with the supply orders." : best.qty >= need ? "Upload the supply orders / invoices as proof." : `Short by ${(need - best.qty).toLocaleString("en-IN")}; MSEs and startups may be exempt if the bid says so.` });
  }
  return rows;
}
