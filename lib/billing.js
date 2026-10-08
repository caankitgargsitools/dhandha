// Billing helpers with no database or network. SQL (billing_create_order) is the source of truth for
// amounts; these mirror it for display and are unit-tested in tests/billing.test.mjs.

export const TOPUP_PACKS = [500, 1000, 2500, 5000];

export function quote(base, gstRate = 18) {
  const b = Math.round(Number(base) || 0);
  const gst = Math.round(b * gstRate) / 100;
  return { base: b, gst, total: Math.round((b + gst) * 100) / 100 };
}

// Plan price: the platform module is always included; the suite has its own price.
export function planQuote(modules, chosen, { suite = false, suiteFee = 2499, suiteCredits = 1500, gstRate = 18 } = {}) {
  if (suite) return { ...quote(suiteFee, gstRate), credits: Number(suiteCredits), modules: modules.map((m) => m.code) };
  const picked = modules.filter((m) => m.code === "platform" || chosen.includes(m.code));
  const base = picked.reduce((s, m) => s + Number(m.monthly_fee_inr), 0);
  return { ...quote(base, gstRate), credits: picked.reduce((s, m) => s + Number(m.included_credits), 0), modules: picked.map((m) => m.code) };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`);
const three = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : "", two(n % 100)].filter(Boolean).join(" ");

// Indian numbering for the invoice: 235646.5 -> "Rupees Two Lakh Thirty Five Thousand Six Hundred Forty Six and Fifty Paise Only"
export function rupeesInWords(amount) {
  const total = Math.round(Number(amount || 0) * 100);
  let r = Math.floor(total / 100);
  const p = total % 100;
  const parts = [];
  for (const [div, name] of [[1e7, "Crore"], [1e5, "Lakh"], [1e3, "Thousand"]]) {
    if (r >= div) { parts.push(`${div === 1e7 ? rupeesInWords(Math.floor(r / div)).replace(/^Rupees | Only$/g, "") : two(Math.floor(r / div))} ${name}`); r %= div; }
  }
  if (r) parts.push(three(r));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${p ? ` and ${two(p)} Paise` : ""} Only`;
}
