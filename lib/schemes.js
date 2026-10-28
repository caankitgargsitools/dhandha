// Government schemes finder (pure, tested): central schemes for small businesses, matched in plain words against the
// Vault (Udyam number, MSME category, constitution, age, state, a few yes/no facts). We only point people to the
// right scheme — amounts and rules change, so every card links to the official site. Status:
//   likely — the Vault says they fit; check — an answer is missing (asked as a question); unlikely — something rules it out.
const years = (d, now) => (d ? (now - new Date(d)) / (365.25 * 864e5) : null);

export const FACTS = {
  "owner.women": "Is the business owned (51%+) by a woman?",
  "owner.sc_st": "Is the business owned (51%+) by a Scheduled Caste or Scheduled Tribe person?",
  "plan.new_unit": "Are you planning to start a new unit or a new manufacturing / service business?",
  "need.loan": "Do you need a business loan (working capital or for machinery)?",
  "dpiit.recognised": "Is the company recognised as a startup by DPIIT (Startup India)?",
  "sells.to_large": "Do you sell to large companies or government departments that pay you late?",
};

export const SCHEMES = [
  { id: "udyam", name: "Udyam registration (MSME)", url: "https://udyamregistration.gov.in", tag: "Start here",
    what: "Free, online MSME registration. Unlocks almost every scheme below, EMD exemption in government tenders and protection against late payments.",
    test: (c) => (c.udyam_no ? ["done", "You already have Udyam number " + c.udyam_no] : ["likely", "No Udyam number in your Vault — register free (Aadhaar + PAN)."]) },
  { id: "ppp_mse", name: "Public Procurement Policy for MSEs", url: "https://msme.gov.in", tag: "Tenders",
    what: "Registered micro and small enterprises get tender documents free and EMD exemption in most central government tenders, and a share of purchases reserved for MSEs (with extra preference for SC/ST- and women-owned MSEs).",
    test: (c) => !c.udyam_no ? ["check", "Needs Udyam registration first."]
      : c.msme_category === "medium" ? ["unlikely", "Benefits are for micro and small enterprises; your Vault says medium."]
      : ["likely", "Attach your Udyam certificate with bids and claim EMD / fee exemption where the tender allows it."] },
  { id: "gem_mse", name: "GeM — sell to government as an MSE", url: "https://gem.gov.in", tag: "Tenders",
    what: "Register on the Government e-Marketplace; MSE sellers get purchase preference and EMD exemption on many bids.",
    test: (c) => (c.udyam_no ? ["likely", "With Udyam you can register on GeM as an MSE seller."] : ["check", "Register on Udyam first, then GeM."]) },
  { id: "cgtmse", name: "CGTMSE — collateral-free loans", url: "https://www.cgtmse.in", tag: "Finance",
    what: "Bank loans for micro and small enterprises without collateral or third-party guarantee — the government trust guarantees them. Ask your bank for a CGTMSE-covered loan.",
    test: (c, f) => f["need.loan"] === "no" ? ["unlikely", "You said you don't need a loan now."]
      : c.msme_category === "medium" ? ["unlikely", "For micro and small enterprises."]
      : !c.udyam_no ? ["check", "Banks will ask for Udyam registration."]
      : f["need.loan"] === "yes" ? ["likely", "Ask your bank for a CGTMSE-covered loan — no collateral."] : ["check", "Do you need a loan?", "need.loan"] },
  { id: "mudra", name: "PM MUDRA loans", url: "https://www.mudra.org.in", tag: "Finance",
    what: "Small loans for non-farm micro businesses (Shishu, Kishore, Tarun, Tarun Plus) through banks, NBFCs and MFIs, without collateral.",
    test: (c, f) => f["need.loan"] === "no" ? ["unlikely", "You said you don't need a loan now."]
      : ["public_limited"].includes(c.constitution) ? ["unlikely", "Meant for micro and small businesses."]
      : c.msme_category && c.msme_category !== "micro" ? ["check", "Best suited to micro businesses; your Vault says " + c.msme_category + "."]
      : f["need.loan"] === "yes" ? ["likely", "Apply at any bank branch or on the Udyamimitra portal."] : ["check", "Do you need a loan?", "need.loan"] },
  { id: "pmegp", name: "PMEGP — subsidy for a new unit", url: "https://www.kviconline.gov.in/pmegpeportal/", tag: "New business",
    what: "Margin-money subsidy on bank loans for setting up a new manufacturing or service unit (higher subsidy for women, SC/ST and rural applicants).",
    test: (c, f) => f["plan.new_unit"] === "yes" ? ["likely", "Apply online on the KVIC PMEGP portal for the new unit."]
      : f["plan.new_unit"] === "no" ? ["unlikely", "For new units only — existing units are not covered (except the upgrade window for earlier PMEGP units)."]
      : ["check", "For new units only.", "plan.new_unit"] },
  { id: "standup", name: "Stand-Up India", url: "https://www.standupmitra.in", tag: "Finance",
    what: "Bank loans from ₹10 lakh to ₹1 crore for a greenfield enterprise set up by a woman or an SC/ST entrepreneur.",
    test: (c, f) => {
      if (f["owner.women"] === "no" && f["owner.sc_st"] === "no") return ["unlikely", "For women or SC/ST entrepreneurs."];
      if (f["plan.new_unit"] === "no") return ["unlikely", "For a new (greenfield) enterprise."];
      if ((f["owner.women"] === "yes" || f["owner.sc_st"] === "yes") && f["plan.new_unit"] === "yes") return ["likely", "Apply on the Stand-Up Mitra portal or at your bank."];
      return ["check", "For a new enterprise by a woman or SC/ST entrepreneur.", f["owner.women"] ? (f["plan.new_unit"] ? "owner.sc_st" : "plan.new_unit") : "owner.women"];
    } },
  { id: "startup", name: "Startup India (DPIIT recognition)", url: "https://www.startupindia.gov.in", tag: "Startups",
    what: "Recognition for young innovative companies: self-certification under labour and environment laws, faster patents, the Seed Fund, and an income-tax holiday under section 80-IAC (with a separate approval).",
    test: (c, f, now) => {
      if (f["dpiit.recognised"] === "yes") return ["done", "Already recognised — check Seed Fund and 80-IAC."];
      const age = years(c.incorporation_date, now);
      if (["proprietorship", "trust", "society"].includes(c.constitution)) return ["unlikely", "Needs a company, LLP or registered partnership firm."];
      if (age !== null && age > 10) return ["unlikely", "Only for entities under 10 years old."];
      if (age === null) return ["check", "Add your date of incorporation in the Vault."];
      return ["likely", `Your entity is ${Math.floor(age)} years old — apply on the Startup India portal if your work is innovative or scalable.`];
    } },
  { id: "zed", name: "MSME ZED certification", url: "https://zed.msme.gov.in", tag: "Quality",
    what: "Zero Defect Zero Effect quality certification (Bronze, Silver, Gold) with most of the cost borne by the government for micro and small units; some tenders and banks value it.",
    test: (c) => (!c.udyam_no ? ["check", "Needs Udyam registration first."] : ["likely", "Start with the free Bronze pledge on the ZED portal."]) },
  { id: "treds", name: "TReDS — get paid early on invoices", url: "https://www.rbi.org.in", tag: "Cash flow",
    what: "RBI-licensed platforms (RXIL, M1xchange, Invoicemart and others) where MSMEs sell invoices raised on large buyers and PSUs for quick payment.",
    test: (c, f) => !c.udyam_no ? ["check", "Needs Udyam registration."]
      : f["sells.to_large"] === "yes" ? ["likely", "Register on a TReDS platform; ask your big buyers to join."]
      : f["sells.to_large"] === "no" ? ["unlikely", "Useful when you invoice large companies or PSUs."] : ["check", "Do big buyers pay you late?", "sells.to_large"] },
  { id: "samadhaan", name: "MSME Samadhaan — delayed payments", url: "https://samadhaan.msme.gov.in", tag: "Cash flow",
    what: "Micro and small enterprises can file a case online when a buyer does not pay within 45 days; the council can order payment with interest.",
    test: (c, f) => !c.udyam_no ? ["check", "Needs Udyam registration."]
      : c.msme_category === "medium" ? ["unlikely", "For micro and small enterprises."]
      : f["sells.to_large"] === "yes" ? ["likely", "File on MSME Samadhaan for dues older than 45 days."] : ["check", "Useful if a buyer pays late.", "sells.to_large"] },
];

const ORDER = { likely: 0, check: 1, done: 2, unlikely: 3 };

// company = Vault company record; facts = { key: "yes" | "no" } from company_facts
export function matchSchemes(company = {}, facts = {}, now = new Date()) {
  return SCHEMES.map((s) => {
    const [status, why, ask] = s.test(company || {}, facts || {}, now);
    return { id: s.id, name: s.name, url: s.url, tag: s.tag, what: s.what, status, why, ask: ask ? { key: ask, question: FACTS[ask] } : null };
  }).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
}
