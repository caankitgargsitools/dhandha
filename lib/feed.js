// Live feeds for Google Sheets (=IMPORTDATA) and Excel (Data → From Web): the database gives rows (feed_rows), these
// helpers put the columns in a fixed order and write CSV.
export const COLUMNS = {
  tenders: ["Title", "Portal", "Authority", "State", "Value (Rs)", "EMD (Rs)", "Closes", "Stage", "Score", "Tender ID", "Open in Dhandha"],
  leads: ["Name", "Contact", "Phone", "Email", "City", "State", "Source", "Status", "Score", "Added", "Next follow-up", "Open in Dhandha"],
};

// one CSV cell: quoted when needed; a leading = + - @ is neutralised so a sheet never runs it as a formula
export function cell(v) {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows, columns) => [columns.map(cell).join(","), ...(rows || []).map((r) => columns.map((c) => cell(r[c])).join(","))].join("\r\n") + "\r\n";
