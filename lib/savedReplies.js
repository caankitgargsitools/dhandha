// Saved replies (C45; pure, tested): ready answers the team sends with one tap from the WhatsApp inbox — fees,
// documents needed, bank details, address. Placeholders are filled from the conversation:
// {first_name} {name} (the client), {company} (the client's company), {my_name} (the person replying),
// {my_company} (your business). An unknown placeholder is left as it is, so nothing is silently dropped.

export const PLACEHOLDERS = ["first_name", "name", "company", "my_name", "my_company"];

export const STARTERS = [
  { title: "Thanks — we'll call you", shortcut: "thanks", body: "Thank you {first_name}! This is {my_name} from {my_company}. I will call you shortly to understand your requirement. What time suits you today?" },
  { title: "Fees and proposal", shortcut: "fees", body: "Dear {first_name}, our fee depends on the scope. Could you share a few details — nature of business, turnover range and the services you need? I will send you a written proposal within a day." },
  { title: "Documents we need", shortcut: "docs", body: "To get started, please share: 1) PAN and GST certificate, 2) last year's financial statements, 3) bank statements for the period, 4) any notices received. You can send photos or PDFs here." },
  { title: "Bank details for payment", shortcut: "bank", body: "Please make the payment to {my_company}. [Bank name, account number, IFSC — edit this reply once with your details.] Share the transaction reference here once done. Thank you!" },
  { title: "Office address and timings", shortcut: "address", body: "Our office: [address — edit once]. We are open Monday to Saturday, 10 am to 7 pm. Please call before visiting so the right person is available." },
  { title: "Follow-up", shortcut: "followup", body: "Hello {first_name}, just following up on our conversation. Is there anything else you need from our side to go ahead?" },
];

const firstName = (s) => String(s || "").trim().replace(/^(mr|mrs|ms|dr|ca|cs|shri|smt)\.?\s+/i, "").split(/\s+/)[0] || "";

// the reply text for this conversation
export function fillReply(body = "", ctx = {}) {
  const person = ctx.contact || ctx.name || "";
  const values = {
    first_name: firstName(person) || "there",
    name: person || "there",
    company: ctx.company || "",
    my_name: firstName(ctx.myName) || ctx.myName || "",
    my_company: ctx.myCompany || "",
  };
  return String(body).replace(/\{(\w+)\}/g, (m, k) => (k in values && values[k] !== "" ? values[k] : k in values ? "" : m))
    .replace(/[ \t]{2,}/g, " ").replace(/ ([,.!?])/g, "$1").trim();
}

// most-used first, then by title; a search looks at the title, shortcut and text
export function filterReplies(list = [], q = "") {
  const s = String(q).trim().toLowerCase().replace(/^\//, "");
  return list
    .filter((r) => !r.archived && (!s || `${r.title} ${r.shortcut || ""} ${r.body}`.toLowerCase().includes(s)))
    .sort((a, b) => (b.uses || 0) - (a.uses || 0) || String(a.title).localeCompare(String(b.title)));
}

export function cleanShortcut(s) {
  return String(s || "").toLowerCase().replace(/^\//, "").replace(/[^a-z0-9_-]/g, "").slice(0, 24) || null;
}
