// Dhandha Map (owner, 11 Nov: items 1–5 and 11 from the "company map" idea): turns company_map() into the cards,
// agents, flow and drift alerts the page shows, with the "Learn mode" text for each. Pure and tested.

const inr = (n) => {
  const v = Number(n) || 0;
  return v >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : v >= 1e5 ? `₹${(v / 1e5).toFixed(1)} L` : `₹${Math.round(v).toLocaleString("en-IN")}`;
};

// The nine parts of the business on the map. `tone` bad / warn picks the colour of the node's ring.
export function nodeCards(map = {}) {
  const n = map.nodes || {}, s = map.series || {};
  const t = n.tenders || {}, l = n.leads || {}, p = n.pipeline || {}, o = n.outreach || {}, c = n.customers || {}, w = n.work || {}, b = n.backoffice || {}, i = n.intelligence || {}, v = n.vault || {};
  return [
    { key: "tenders", label: "Tenders", href: "/app/tenders", big: t.open ?? 0, bigLabel: "open matches", series: s.matches,
      lines: [`${t.in_hand ?? 0} in hand`, `${t.new24 ?? 0} new today`, `${t.prechecked24 ?? 0} pre-checked today`],
      tone: t.closing48 ? "bad" : null, alert: t.closing48 ? `${t.closing48} closing within 48 h` : null,
      learn: "Every tender from GeM, CPPP and state portals that fits your services, scored against your Vault. Pre-checked ones were already read for free." },
    { key: "leads", label: "Leads", href: "/app/leads", big: l.open ?? 0, bigLabel: "open leads", series: s.leads,
      lines: [`${l.new24 ?? 0} new today`, `${inr(l.cost24)} spent today`],
      tone: l.followups_overdue ? "warn" : null, alert: l.followups_overdue ? `${l.followups_overdue} follow-ups overdue` : null,
      learn: "People and firms who may buy from you — from Google Maps, tender winners, new companies, your website, ads and imports." },
    { key: "pipeline", label: "Deals", href: "/app/crm", big: inr(p.open_value), bigLabel: `${p.open ?? 0} open deals`,
      lines: [`Won this month ${inr(p.won_month)}`],
      tone: p.stale > 20 ? "warn" : null, alert: p.stale ? `${p.stale} with no step for 7 days` : null,
      learn: "Each lead you are working on, from first message to won. A deal with no next step for a week is going cold." },
    { key: "outreach", label: "Marketing", href: "/app/leads/playbook", big: o.sent24 ?? 0, bigLabel: "messages sent today", series: s.messages,
      lines: [`${o.queued ?? 0} waiting to go`],
      tone: o.failed24 ? "bad" : null, alert: o.failed24 ? `${o.failed24} failed today` : null,
      learn: "WhatsApp and e-mail your playbooks send by themselves, in your office hours." },
    { key: "customers", label: "Customers", href: "/app/crm/customers", big: c.wa_open ?? 0, bigLabel: "open chats",
      lines: [`${c.wa_unread ?? 0} unread`, c.rating ? `Google ${c.rating}★ (${c.reviews ?? 0})` : `${c.reviews_asked30 ?? 0} reviews asked (30 days)`],
      tone: c.wa_unassigned ? "warn" : null, alert: c.wa_unassigned ? `${c.wa_unassigned} chats with nobody on them` : null,
      learn: "Your clients' WhatsApp messages, review requests after a win and your Google rating." },
    { key: "work", label: "Work in hand", href: "/app/work", big: w.active ?? 0, bigLabel: "won jobs running",
      lines: [`${inr(w.value)} in hand`, `${w.submitted ?? 0} bids awaiting result`, `${w.completed90 ?? 0} completed (90 days)`],
      learn: "Tenders you won and are delivering. Marking one complete adds it to your Experience, so it counts for the next tender." },
    { key: "backoffice", label: "Back office", href: "/app/crm/invoices", big: inr(b.receivable), bigLabel: "to be received",
      lines: [`${inr(b.deposits_held)} EMD / BG with departments`, `${inr(b.refunds_due)} refunds due`],
      tone: b.overdue ? "bad" : null, alert: b.overdue ? `${b.overdue} invoices overdue` : null,
      learn: "Money: invoices not yet paid, EMDs and bank guarantees lying with departments, and refunds you should chase." },
    { key: "intelligence", label: "Intelligence", href: "/app/tenders/rivals", big: i.ai_checked24 ?? 0, bigLabel: "tenders checked by AI today",
      lines: [`${i.ai_hidden24 ?? 0} hidden as not your work`, `${i.rivals ?? 0} rivals followed · ${i.awards ?? 0} results known`],
      learn: "What Dhandha learns: the AI check of each tender, your rivals' wins and past results that set the price to win." },
    { key: "vault", label: "Vault", href: "/app/vault/masters", big: v.docs ?? 0, bigLabel: "documents",
      lines: [`${v.expiring30 ?? 0} expiring in 30 days`],
      tone: v.expired ? "bad" : v.expiring30 ? "warn" : null, alert: v.expired ? `${v.expired} expired` : null,
      learn: "Your firm's documents, facts, works and people — filled once, used in every bid and format." },
  ];
}

// The automatic workers, with what each did lately (agents panel)
export const AGENTS = {
  autopilot: ["Lead autopilot", "/app/leads/autopilot", "Finds new leads every morning within your daily budget and starts their playbook."],
  ai_check: ["AI tender check", "/app/tenders/preferences", "Reads each new tender's scope every hour and hides the ones that are not your work."],
  precheck: ["Document pre-check", "/app/tenders", "Fetches tender documents in advance and reads them free, so the Tenders page shows what each one needs."],
  playbooks: ["Playbooks", "/app/leads/playbook", "Send WhatsApp, e-mail, booking links and calls to new leads, step by step, in office hours."],
  closing_alerts: ["Closing alerts", "/app/tenders/closing", "Alert your phone 72, 24 and 6 hours before a bid in hand closes unfiled."],
  winback: ["Win-back", "/app/crm/winback", "Brings lost deals and quiet customers back as tasks after the days you set."],
  reviews: ["Review requests", "/app/leads/google-profile", "Asks every won customer for a Google review."],
  corrigenda: ["Corrigendum reader", "/app/tenders/closing", "When a bid in hand changes, fetches the corrigendum and shows what changed."],
};
export function agentRows(agents = [], now = new Date()) {
  return agents.map((a) => {
    const [label, href, learn] = AGENTS[a.key] || [a.key, "/app", ""];
    const last = a.last ? new Date(a.last) : null;
    const ago = last ? Math.round((now - last) / 60000) : null;
    return { ...a, label, href, learn, ago: ago == null ? "not run yet" : ago < 60 ? `${ago} min ago` : ago < 1440 ? `${Math.round(ago / 60)} h ago` : `${Math.round(ago / 1440)} d ago`,
      state: !a.on ? "off" : a.failed ? "warn" : "on" };
  });
}

// Drift: today against the average of the last 7 days (owner chose 11: alert when a number jumps or drops)
export function drift(series = [], { min = 5 } = {}) {
  if (!Array.isArray(series) || series.length < 4) return null;
  const today = Number(series[series.length - 1]) || 0;
  const before = series.slice(0, -1).map(Number);
  const avg = before.reduce((a, b) => a + b, 0) / before.length;
  if (avg < min && today < min) return null; // too small to mean anything
  const change = avg ? Math.round(((today - avg) / avg) * 100) : 100;
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }));
  // before 3 pm a low count is just the day not over yet: only a jump is flagged then
  const low = change <= -50 && hour >= 15, high = change >= 100;
  return low || high ? { today, avg: Math.round(avg), change, dir: high ? "up" : "down" } : null;
}
export function driftAlerts(series = {}) {
  const names = { leads: "New leads", matches: "New tender matches", messages: "Messages sent" };
  return Object.entries(names).map(([k, label]) => ({ k, label, d: drift(series[k]) })).filter((x) => x.d)
    .map(({ k, label, d }) => ({ key: k, text: `${label} ${d.dir === "up" ? "jumped" : "fell"} to ${d.today} today (usual ${d.avg} a day, ${d.change > 0 ? "+" : ""}${d.change}%)`, tone: d.dir === "down" ? "bad" : "info" }));
}

// The pipeline flow: Find → Qualify → Prepare → File → Win → Deliver → Get paid, and the sales funnel
export function flowStages(flow = {}) {
  const t = flow.tenders || {}, d = flow.deals || {}, p = flow.paid || {};
  return {
    tenders: [
      { key: "found", label: "Find", n: t.found ?? 0, href: "/app/tenders", learn: "Open tenders that fit your services." },
      { key: "shortlisted", label: "Qualify", n: t.shortlisted ?? 0, href: "/app/tenders?tab=shortlisted", learn: "Ones you shortlisted to look at closely." },
      { key: "preparing", label: "Prepare", n: t.preparing ?? 0, href: "/app/tenders/closing", stuck: t.stuck_preparing || 0, learn: "Bids being prepared in the assistant. Stuck = closing in 48 hours with no price yet." },
      { key: "submitted", label: "File", n: t.submitted ?? 0, href: "/app/tenders?stage=submitted", learn: "Filed on the portal, waiting for the result." },
      { key: "won", label: "Win", n: t.won ?? 0, href: "/app/tenders/outcomes", learn: "Won in the last six months." },
      { key: "delivering", label: "Deliver", n: t.delivering ?? 0, href: "/app/work", learn: "Won work still running." },
      { key: "paid", label: "Get paid", n: p.outstanding ?? 0, href: "/app/crm/invoices", learn: "Invoices raised and not yet paid in full." },
    ],
    sales: ["new", "contacted", "called", "qualified", "link_sent", "meeting", "proposal", "negotiation", "won"].map((k) => ({
      key: k, n: d[k] || 0, label: { new: "New", contacted: "Messaged", called: "Called", qualified: "Qualified", link_sent: "Link sent", meeting: "Meeting", proposal: "Proposal", negotiation: "Negotiation", won: "Won" }[k],
    })),
  };
}

// "Needs your call": one list of things waiting for a person, most urgent first
export function needsList(needs = {}, role = "") {
  const out = [];
  for (const m of needs.closing || []) out.push({ key: `c${m.id}`, tone: "bad", text: `Bid closes ${new Date(m.due).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}: ${m.title}`, href: `/app/tenders/${m.id}#file-it`, act: "Open" });
  for (const k of needs.tasks || []) out.push({ key: `t${k.id}`, tone: new Date(k.due) < new Date() ? "bad" : "warn", text: `Task: ${k.title}`, href: "/app/tasks", act: "Do it" });
  for (const q of needs.quotes_to_invoice || []) out.push({ key: `q${q.id}`, tone: "info", text: `Quotation ${q.number} accepted by ${q.client} — raise the invoice`, href: `/app/crm/invoices/new?quote=${q.id}`, act: "Invoice" });
  if (needs.followups) out.push({ key: "f", tone: "warn", text: `${needs.followups} of your follow-ups are overdue`, href: "/app/leads?tab=followups", act: "Call list" });
  if (needs.wa_unassigned) out.push({ key: "w", tone: "warn", text: `${needs.wa_unassigned} WhatsApp chats with nobody on them`, href: "/app/inbox?tab=unassigned", act: "Assign" });
  if (needs.partners) out.push({ key: "p", tone: "info", text: `${needs.partners} partner request${needs.partners === 1 ? "" : "s"} waiting`, href: "/app/tenders/partners?tab=requests", act: "Answer" });
  if (needs.resets && role === "admin") out.push({ key: "r", tone: "info", text: `${needs.resets} password reset${needs.resets === 1 ? "" : "s"} asked — send the link`, href: "/app/settings/team", act: "Team" });
  return out;
}

// "Always on": each connection green / amber / grey, with where to set it up
export function connectionRows(c = {}, env = {}, now = new Date()) {
  const fresh = (d, h) => d && now - new Date(d) < h * 3600000;
  return [
    { key: "crawler", label: "Tender crawler", state: fresh(c.crawler, 6) ? "on" : "warn", note: c.crawler ? `last run ${new Date(c.crawler).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}` : "not run" },
    { key: "sessions", label: "Portal sessions", state: (c.sessions_live || 0) > 0 ? "on" : "warn", note: `${c.sessions_live || 0} live` },
    { key: "ai", label: "AI reading", state: env.ai ? "on" : "off", note: env.ai ? "free tier first" : "no AI key" },
    { key: "maps", label: "Google Maps", state: c.maps?.ok ? "on" : "warn", note: c.maps?.ok ? "working" : "check failed" },
    { key: "whatsapp", label: "WhatsApp sending", state: c.whatsapp ? "on" : "off", note: c.whatsapp ? "connected" : "not set up", href: "/app/outreach/settings" },
    { key: "wa_inbox", label: "WhatsApp replies", state: c.wa_inbox ? "on" : "off", note: c.wa_inbox ? "inbox on" : "not set up", href: "/app/outreach/settings" },
    { key: "email", label: "E-mail sending", state: c.email ? "on" : "off", note: c.email ? "ready" : "not switched on" },
    { key: "gmail", label: "Gmail enquiries", state: c.gmail?.on ? (fresh(c.gmail.last, 48) ? "on" : "warn") : "off", note: c.gmail?.on ? (c.gmail.last ? "script running" : "waiting for first mail") : "not set up", href: "/app/leads/email" },
    { key: "drive", label: "Google Drive", state: c.drive ? "on" : "off", note: c.drive ? "connected" : "not connected", href: "/app/settings/drive" },
    { key: "meta", label: "Facebook / Instagram", state: c.meta ? "on" : "off", note: c.meta ? `${c.meta} page${c.meta === 1 ? "" : "s"}` : "not connected", href: "/app/settings/facebook" },
    { key: "google_ads", label: "Google Ads forms", state: c.google_ads ? "on" : "off", note: c.google_ads ? `${c.google_ads.leads || 0} leads` : "not set up", href: "/app/leads/google-ads" },
    { key: "apollo", label: "Apollo", state: c.apollo ? "on" : "off", note: c.apollo ? "connected" : "no key", href: "/app/leads/apollo" },
    { key: "payments", label: "Online payments", state: env.razorpay ? "on" : "off", note: env.razorpay ? "Razorpay on" : "not switched on" },
  ];
}
