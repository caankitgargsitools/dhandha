// Which link on MCA's "incorporated during the month" page is the newest monthly file (tested in test/mcaPick.test.js).
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// "Companies incorporated in September 2026.xlsx" / "Sep_2026" / "09-2026" → 202609 (null when no month and year)
export function monthOf(text) {
  const s = String(text || "").toLowerCase();
  const word = s.match(/(?:^|[^a-z])(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s_\-.,']*(20\d{2})(?!\d)/);
  if (word) return Number(word[2]) * 100 + MONTHS.indexOf(word[1]) + 1;
  const num = s.match(/(?:^|[^\d])(0?[1-9]|1[0-2])[\s_\-./](20\d{2})(?!\d)/) || s.match(/(?:^|[^\d])(20\d{2})[\s_\-./](0?[1-9]|1[0-2])(?!\d)/);
  if (!num) return null;
  return /^20/.test(num[1]) ? Number(num[1]) * 100 + Number(num[2]) : Number(num[2]) * 100 + Number(num[1]);
}

// links: [{ href, text }] → the newest spreadsheet (or zip) by the month in its text or file name
export function pickLatest(links) {
  const files = links
    .filter((l) => /\.(xlsx|xls|csv|zip)(\?|$)/i.test(l.href || ""))
    .map((l) => ({ ...l, month: monthOf(`${l.text} ${decodeURIComponent(String(l.href).split("/").pop())}`) }))
    .filter((l) => l.month);
  files.sort((a, b) => b.month - a.month || (/\.xlsx/i.test(b.href) ? 1 : 0) - (/\.xlsx/i.test(a.href) ? 1 : 0));
  return files[0] || null;
}

// MCA's site answers a bot check instead of the page
export const looksBlocked = (status, text) => status === 403 || status === 429 || /access denied|request unsuccessful|verify you are (a )?human|are you a robot|captcha|incapsula|akamai/i.test(String(text || "").slice(0, 5000));
