// Corrigenda in plain words (mirrors SQL private.change_text): what changed on a tender since it was published.
const IST = { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false };
const when = (v) => new Date(v).toLocaleString("en-IN", IST).replace(",", "");
const lakhs = (v) => `₹${(Number(v) / 1e5).toFixed(2)} lakh`;
const rupees = (v) => `₹${Number(v).toLocaleString("en-IN")}`;

export function changeText(c) {
  const { field, old_value: o, new_value: n } = c || {};
  if (field === "due_at") return `Closing ${when(o)} → ${when(n)}`;
  if (field === "opening_at") return `Opening ${when(o)} → ${when(n)}`;
  if (field === "value_inr") return o && n ? `Value ${lakhs(o)} → ${lakhs(n)}` : "Value changed";
  if (field === "emd_inr") return o && n ? `EMD ${rupees(o)} → ${rupees(n)}` : "EMD changed";
  if (field === "status") return `Status: ${n || "changed"}`;
  if (field === "title") return "Title / scope wording changed";
  return `${field} changed`;
}

// Real corrigenda only: older rows logged a value the list page did not carry as "changed to nothing".
export const realChange = (c) => c && c.old_value != null && c.new_value != null && c.new_value !== "";

// The latest few changes per tender, newest first, for chips on the Tenders list.
export function latestByTender(rows, per = 2) {
  const out = {};
  for (const c of rows || []) {
    if (!realChange(c)) continue;
    (out[c.tender_id] ||= []).length < per && out[c.tender_id].push(c);
  }
  return out;
}
