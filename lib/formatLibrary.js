import { matchTemplates, headingOnly, templateById } from "./formatTemplates.js";

// Free template library: tender formats that Dhandha can fill from the Vault without any AI.
export const LIBRARY = {
  covering_letter: { label: "Covering letter / Form of bid", re: /(covering letter|letter of (transmittal|submission)|form of (bid|tender)|bid (submission )?form|tender form|letter of (bid|offer))/i },
  bidder_info: { label: "Bidder information", re: /(bidder'?s? (information|profile|details|particulars)|(information|details|particulars) (of|about) (the )?(bidder|tenderer|firm|company)|general information|firm'?s? profile|company profile)/i },
  turnover: { label: "Financial turnover / net worth", re: /(turnover|financial (capability|information|statement|details|data)|net ?worth|annual accounts)/i },
  similar_works: { label: "Similar works / experience", re: /(similar works?|works? (completed|executed|in hand|in progress)|work experience|experience (details|of the bidder|statement)|list of (completed )?works|past performance)/i },
  key_personnel: { label: "Key personnel", re: /(key personnel|technical (staff|personnel)|manpower|staff (details|deployment)|curriculum vitae|\bCV\b|qualified staff)/i },
  non_blacklisting: { label: "Non-blacklisting declaration", re: /(black[- ]?list|debar|banned|not been (blacklisted|debarred))/i },
  mse: { label: "MSE declaration", re: /(\bMSE\b|micro (and|&) small|\bMSME\b|udyam|nsic)/i },
  reference: { label: "Not part of the bid (reference / after award)", re: /(contract agreement|draft (contract|agreement)|agreement form|form of (contract|agreement)|letter of (acceptance|award|intent)|notification of award|performance (bank )?guarantee|performance security|general conditions|special conditions|terms of reference|terms of payment)/i },
  price: { label: "Price schedule (fill on the portal)", re: /(price (bid|schedule|format|proposal|offer)|financial (bid|proposal|offer|quote)|fee (proposal|quote|schedule)|\bBOQ\b|bill of quantit|schedule of rates|commercial (bid|offer)|rates? (schedule|quote|quoted)|quotation (form|format)|form of (financial|price)|unit rate|\bFIN-\d)/i },
};

export function classifyFormat(title, text = "") {
  const t = `${title}`;
  for (const [key, def] of Object.entries(LIBRARY)) if (def.re.test(t)) return key;
  // look at the first lines of the format's own text if the title is just "Annexure C"
  const head = String(text).split("\n").slice(0, 4).join(" ");
  for (const [key, def] of Object.entries(LIBRARY)) if (def.re.test(head)) return key;
  return "custom";
}

// What each choice means, shown in the assistant's format picker.
export const CHOICES = {
  covering_letter: "Covering letter on your letterhead",
  bidder_info: "Bidder information table from your masters",
  turnover: "Turnover and net worth statement",
  similar_works: "List of completed similar works",
  key_personnel: "Key personnel list",
  non_blacklisting: "Non-blacklisting declaration",
  mse: "MSE / Udyam declaration",
  custom: "The tender's own wording, filled from your masters (AI, 49 credits for all such formats)",
  price: "Price bid — quoted on the portal",
  reference: "Not part of the bid (reference / after award)",
  manual: "I'll fill this one myself",
};

// Every choice that fits a format, best first: the built-in tables, the standard versions from the catalogue
// ("tpl:<id>", filled free from the Vault), the tender's own wording filled by AI, and "fill it myself".
// A format the tender only names (a heading with no text) gets the standard versions first, and the AI choice
// becomes "write it from the heading".
export function candidates(title, text = "", { constitution } = {}) {
  const head = `${title} ${String(text).split("\n").slice(0, 4).join(" ")}`;
  const fits = Object.entries(LIBRARY).filter(([, def]) => def.re.test(head)).map(([k]) => k);
  const best = classifyFormat(title, text);
  const lib = [...new Set([best, ...fits])].filter((k) => k !== "custom");
  if (lib.includes("price")) return ["price", "manual"];
  // contract forms, guarantees given after award, and terms: not filed with the bid unless the tender says so
  const tpls = matchTemplates(title, text, { constitution }).slice(0, 4).map((t) => `tpl:${t.id}`);
  // guarantees given after award: the bank's text is offered, but nothing is filed with the bid unless chosen
  if (best === "reference") return ["reference", ...tpls.filter((k) => /guarantee/.test(k)), "custom", "manual"];
  // the tender's prescribed wording is filed as it is wherever the tender prints it ("not in the prescribed format" rejects bids)
  return headingOnly(text) ? [...tpls, ...lib, "custom", "manual"] : ["custom", ...lib, ...tpls, "manual"];
}

// The label of a choice in the picker.
export function choiceLabel(kind, text = "") {
  if (String(kind).startsWith("tpl:")) {
    const t = templateById(kind.slice(4));
    return t ? `${t.label}${t.stamp ? " · stamp paper" : ""} (free)` : kind;
  }
  if (kind === "custom" && headingOnly(text)) return "Write it with AI from the heading (49 credits for all such formats)";
  return CHOICES[kind] || kind;
}
