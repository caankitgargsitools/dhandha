// Email enquiries → leads (C42; pure, tested). The customer's own mailbox sends each new email to
// /api/email/lead/[token] — from Gmail / Google Workspace by a small Google Apps Script that runs in their own Google
// account every 5 minutes (`appsScript`), or from any service that can POST JSON. Here the email becomes a lead row:
// sender, name, company from a business domain, a phone number found in the text, subject and the start of the body.
// Automatic mail (no-reply, newsletters, bounces, the firm's own domain) is skipped.

export const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.in", "yahoo.in", "hotmail.com", "outlook.com", "live.com",
  "msn.com", "rediffmail.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com", "zohomail.in", "ymail.com", "mail.com", "gmx.com"]);

const AUTO_LOCAL = /^(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce[s]?|notifications?|alerts?|newsletter|news|updates?|marketing|billing|invoice|accounts?-?noreply|support-?noreply|info-?noreply)\b/i;
const AUTO_SUBJECT = /^(auto(matic)? ?reply|out of (the )?office|delivery status notification|undeliverable|mail delivery (failed|subsystem)|returned mail|read receipt)|unsubscribe/i;

// "Ravi Kumar <ravi@acme.in>" → { name, email }
export function parseFrom(from = "") {
  const s = String(from).trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const email = (m ? m[2] : s).trim().toLowerCase();
  const name = (m ? m[1] : "").trim().replace(/\s+/g, " ");
  return { name: name && !name.includes("@") ? name : "", email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "" };
}

export const domainOf = (email = "") => String(email).split("@")[1]?.toLowerCase() || "";

// mail that is not a person writing in
export function isAutomated({ email, subject = "", headers = {} }, own = []) {
  const local = String(email).split("@")[0] || "";
  const dom = domainOf(email);
  if (!email) return "no sender";
  if (own.some((d) => dom === d || dom.endsWith("." + d))) return "your own domain";
  if (AUTO_LOCAL.test(local)) return "automatic sender";
  if (AUTO_SUBJECT.test(String(subject).trim())) return "automatic reply";
  const h = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  if (h["list-unsubscribe"] || h["list-id"] || /^(bulk|list|junk)$/i.test(h.precedence || "") || /auto-(generated|replied)/i.test(h["auto-submitted"] || "")) return "mailing list";
  return "";
}

// first Indian phone number in the text: +91 / 0 prefixes, spaces and dashes allowed → 10 digits
export function phoneIn(text = "") {
  const m = String(text).match(/(?<!\d)(?:\+?91[\s-]?|0)?([6-9](?:[\s-]?\d){9})(?!\d)/);
  return m ? m[1].replace(/\D/g, "") : "";
}

// strip quoted replies and signatures' long tails; keep the first ~1,200 characters
export function bodyText(text = "") {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (const l of lines) {
    if (/^On .{5,200}wrote:$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()) || /^>/.test(l)) break;
    out.push(l);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200);
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

// company guessed from a business domain: "acme-infra.co.in" → "Acme Infra"
export function companyFromDomain(dom = "") {
  if (!dom || FREE_MAIL.has(dom)) return "";
  const base = dom.replace(/\.(co|org|net|gov|ac|edu|firm|gen|ind)\.in$/, "").replace(/\.[a-z]{2,}$/, "").split(".").pop();
  return base ? titleCase(base.replace(/[-_]+/g, " ")) : "";
}

// the lead row for import (or a reason to skip)
export function leadFromEmail(mail = {}, own = []) {
  const { name, email } = parseFrom(mail.from);
  const subject = String(mail.subject || "").trim().slice(0, 200);
  const skip = isAutomated({ email, subject, headers: mail.headers }, own);
  if (skip) return { skip };
  const dom = domainOf(email);
  const company = companyFromDomain(dom);
  const body = bodyText(mail.text || "");
  const phone = phoneIn(`${body}\n${subject}`);
  return {
    message_id: String(mail.message_id || "").slice(0, 300) || null,
    row: {
      name: company || name || email,
      contact_person: name || null,
      email,
      phone: phone || null,
      website: company ? `https://${dom}` : null,
      score: 55,
      score_reasons: ["Wrote to you by email"],
      notes: [`Email enquiry: ${subject || "(no subject)"}`, body].filter(Boolean).join("\n\n").slice(0, 1800),
    },
    subject,
  };
}

// The Google Apps Script the customer pastes at script.google.com (runs in their own Google account; reads only their
// inbox, every 5 minutes, and labels what it sent so nothing goes twice).
export function appsScript({ url, key, query = "in:inbox category:primary newer_than:2d", label = "Dhandha" }) {
  const j = JSON.stringify;
  return `// Dhandha: email enquiries → leads. Paste at script.google.com → New project, Save, then Run "setup" once.
var URL = ${j(url)};
var KEY = ${j(key)};
var QUERY = ${j(query)};
var LABEL = ${j(label)};

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger("sendNew").timeBased().everyMinutes(5).create();
  sendNew();
}

function sendNew() {
  var label = GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  var me = Session.getActiveUser().getEmail().toLowerCase();
  var threads = GmailApp.search(QUERY + " -label:" + LABEL, 0, 30);
  threads.forEach(function (t) {
    var m = t.getMessages()[0];
    if (m.getFrom().toLowerCase().indexOf(me) >= 0) { t.addLabel(label); return; }
    var res = UrlFetchApp.fetch(URL, { method: "post", contentType: "application/json", muteHttpExceptions: true,
      headers: { "x-dhandha-key": KEY },
      payload: JSON.stringify({ from: m.getFrom(), to: m.getTo(), subject: m.getSubject(), text: m.getPlainBody().slice(0, 5000),
        message_id: m.getId(), date: m.getDate().toISOString(),
        headers: { "list-unsubscribe": m.getHeader("List-Unsubscribe"), "precedence": m.getHeader("Precedence"), "auto-submitted": m.getHeader("Auto-Submitted") } }) });
    if (res.getResponseCode() < 300) t.addLabel(label);
  });
}
`;
}
