export const CATEGORIES = { tenders: "Tenders", vault: "Vault & documents", billing: "Billing & credits", leads: "Leads", crm: "CRM & outreach", content: "Content & video", technical: "Login & technical", other: "Something else" };
export const STATUS = {
  open: ["warn", "Open"], in_progress: ["info", "In progress"], waiting_on_customer: ["bad", "Waiting on you"],
  resolved: ["ok", "Resolved"], closed: ["mute", "Closed"],
};
export const STAFF_STATUS = { ...STATUS, waiting_on_customer: ["bad", "Waiting on customer"] };
export const PRIORITY = { low: ["mute", "Low"], normal: ["info", "Normal"], high: ["warn", "High"], urgent: ["bad", "Urgent"] };
export const ago = (d) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
};
