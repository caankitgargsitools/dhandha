// Partner finder (PENDING 31; pure, tested): consortium / JV partners and sub-contracting between Dhandha workspaces.
// Firms opt in (partner_profiles); others see only name, city, turnover band, years and number of completed works.
// Contact details are shared only after a request is accepted (SQL partner_inbox).

export const KINDS = { consortium: "Consortium / JV partner", subcontract: "Sub-contract offer", subwork_interest: "Interested in your sub-work" };
export const STATUS = { pending: ["warn", "Waiting"], accepted: ["ok", "Accepted"], declined: ["mute", "Declined"] };

// what to say when asking a firm to partner on a tender
export function requestText({ tenderTitle, kind = "consortium", from }) {
  const what = kind === "subcontract" ? "take up part of the work as our sub-contractor" : "bid together as a consortium / joint venture";
  return `Namaste — ${from || "we"} would like to ${what}${tenderTitle ? ` for "${tenderTitle.slice(0, 120)}"` : ""}. Can we talk this week?`;
}

// split the inbox into what needs an answer, what we sent, and what is settled
export function sortInbox(rows = []) {
  return {
    toAnswer: rows.filter((r) => r.direction === "in" && r.status === "pending"),
    sent: rows.filter((r) => r.direction === "out" && r.status === "pending"),
    settled: rows.filter((r) => r.status !== "pending"),
  };
}
