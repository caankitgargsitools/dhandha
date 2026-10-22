// Free template library: tender formats that Dhandha can fill from the Vault without any AI.
export const LIBRARY = {
  covering_letter: { label: "Covering letter / Form of bid", re: /(covering letter|letter of (transmittal|submission)|form of (bid|tender)|bid (submission )?form|tender form|letter of (bid|offer))/i },
  bidder_info: { label: "Bidder information", re: /(bidder'?s? (information|profile|details|particulars)|(information|details|particulars) (of|about) (the )?(bidder|tenderer|firm|company)|general information|firm'?s? profile|company profile)/i },
  turnover: { label: "Financial turnover / net worth", re: /(turnover|financial (capability|information|statement|details|data)|net ?worth|annual accounts)/i },
  similar_works: { label: "Similar works / experience", re: /(similar works?|works? (completed|executed|in hand|in progress)|work experience|experience (details|of the bidder|statement)|list of (completed )?works|past performance)/i },
  key_personnel: { label: "Key personnel", re: /(key personnel|technical (staff|personnel)|manpower|staff (details|deployment)|curriculum vitae|\bCV\b|qualified staff)/i },
  non_blacklisting: { label: "Non-blacklisting declaration", re: /(black[- ]?list|debar|banned|not been (blacklisted|debarred))/i },
  mse: { label: "MSE declaration", re: /(\bMSE\b|micro (and|&) small|\bMSME\b|udyam|nsic)/i },
  price: { label: "Price schedule (fill on the portal)", re: /(price (bid|schedule|format)|financial bid|\bBOQ\b|bill of quantit|schedule of rates|commercial bid|rate (schedule|quote))/i },
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
  manual: "I'll fill this one myself",
};

// Every template that fits a format, best first, then the tender's own wording and "fill it myself".
export function candidates(title, text = "") {
  const head = `${title} ${String(text).split("\n").slice(0, 4).join(" ")}`;
  const fits = Object.entries(LIBRARY).filter(([, def]) => def.re.test(head)).map(([k]) => k);
  const best = classifyFormat(title, text);
  const order = [...new Set([best, ...fits])].filter((k) => k !== "custom");
  if (order.includes("price")) return ["price", "manual"];
  return [...order, "custom", "manual"];
}
