// Staff & payroll (owner, map item 10 part 2; 13 Nov): a month's pay per person — pay for days worked, PF and ESI at the
// usual rates, professional tax and TDS as set per person, advances — the pay sheet totals, the bank-transfer sheet and
// the payslip. Statutory rates change: they are kept here in one place (RATES). Pure and tested.

export const RATES = {
  pfPct: 12, pfWageCap: 15000, // employee 12% and employer 12% of basic, basic counted up to ₹15,000
  esiLimit: 21000, esiEmpPct: 0.75, esiErPct: 3.25, // ESI only when gross pay is ₹21,000 a month or less
};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const r0 = (n) => Math.round(Number(n) || 0);

export const daysIn = (month) => { const [y, m] = String(month).split("-").map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };

// s: staff row; input: { days (paid days), advance, bonus } → one pay line
export function payLine(s = {}, input = {}, month) {
  const total = daysIn(month);
  const days = Math.max(0, Math.min(total, input.days == null || input.days === "" ? total : Number(input.days)));
  const f = days / total;
  const gross = Number(s.gross) || 0;
  const basic = r0((gross * (Number(s.basic_pct) || 0)) / 100 * f);
  const earned = r0(gross * f);
  const other = earned - basic;
  const bonus = r0(input.bonus);
  const pfWage = Math.min(basic, RATES.pfWageCap);
  const pfEmp = s.pf ? r0((pfWage * RATES.pfPct) / 100) : 0;
  const pfEr = s.pf ? r0((pfWage * RATES.pfPct) / 100) : 0;
  const esiOn = s.esi && gross <= RATES.esiLimit && earned > 0;
  const esiEmp = esiOn ? Math.ceil(((earned + bonus) * RATES.esiEmpPct) / 100) : 0;
  const esiEr = esiOn ? Math.ceil(((earned + bonus) * RATES.esiErPct) / 100) : 0;
  const pt = earned > 0 ? r0(s.pt) : 0, tds = earned > 0 ? r0(s.tds) : 0, advance = r0(input.advance);
  const deductions = pfEmp + esiEmp + pt + tds + advance;
  const net = earned + bonus - deductions;
  return { staff_id: s.id, name: s.name, designation: s.designation || "", days, total_days: total, basic, other, bonus, earned: earned + bonus,
    pf_emp: pfEmp, esi_emp: esiEmp, pt, tds, advance, deductions, net, pf_er: pfEr, esi_er: esiEr, ctc: earned + bonus + pfEr + esiEr,
    bank_name: s.bank_name || "", bank_account: s.bank_account || "", ifsc: s.ifsc || "", uan: s.uan || "", esic_no: s.esic_no || "", pan: s.pan || "" };
}

// staff working in the month (joined by its end, not left before its start)
export function activeIn(staff = [], month) {
  const start = `${month}-01`, end = `${month}-${String(daysIn(month)).padStart(2, "0")}`;
  return staff.filter((s) => (!s.joined_on || s.joined_on <= end) && (!s.left_on || s.left_on >= start));
}

export function runTotals(lines = []) {
  const k = ["earned", "pf_emp", "esi_emp", "pt", "tds", "advance", "deductions", "net", "pf_er", "esi_er", "ctc"];
  const t = Object.fromEntries(k.map((x) => [x, 0]));
  for (const l of lines) for (const x of k) t[x] += Number(l[x]) || 0;
  t.people = lines.length;
  t.pf_due = t.pf_emp + t.pf_er; // to deposit on the EPFO portal by the 15th of next month
  t.esi_due = t.esi_emp + t.esi_er; // to deposit on the ESIC portal by the 15th of next month
  return Object.fromEntries(Object.entries(t).map(([a, b]) => [a, r2(b)]));
}

const cell = (v) => { const s = String(v ?? ""); return /^[=+\-@]/.test(s) ? `'${s}` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
// bank bulk-transfer sheet: one row per person with a net pay and a bank account
export function bankSheet(lines = [], month) {
  const rows = [["Name", "Account number", "IFSC", "Amount", "Narration"]];
  for (const l of lines) if (l.net > 0 && l.bank_account) rows.push([l.name, l.bank_account, l.ifsc, l.net.toFixed(2), `Salary ${month}`]);
  return rows.map((r) => r.map(cell).join(",")).join("\n");
}
export const missingBank = (lines = []) => lines.filter((l) => l.net > 0 && !l.bank_account).map((l) => l.name);

// amount in words (Indian system) for the payslip
const ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const TENS = "  twenty thirty forty fifty sixty seventy eighty ninety".split(" ");
function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""); }
function three(n) { return n >= 100 ? `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${two(n % 100)}` : ""}` : two(n); }
export function rupeesInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (!n) return "Rupees zero only";
  const parts = [];
  for (const [d, w] of [[1e7, "crore"], [1e5, "lakh"], [1e3, "thousand"]]) if (n >= d) { parts.push(`${three(Math.floor(n / d))} ${w}`); n %= d; }
  if (n) parts.push(three(n));
  const s = parts.join(" ");
  return `Rupees ${s} only`.replace(/^Rupees (\w)/, (m, c) => `Rupees ${c.toUpperCase()}`);
}
