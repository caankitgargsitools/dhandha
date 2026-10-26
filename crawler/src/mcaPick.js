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
    // a spreadsheet link, or MCA's document links (…/bin/dms/getdocument?…) that carry no file extension
    .filter((l) => /\.(xlsx|xls|csv|zip)(\?|$)/i.test(l.href || "") || /getdocument|\/dms\/|download/i.test(l.href || ""))
    .map((l) => ({ ...l, month: monthOf(`${l.text} ${decodeURIComponent(String(l.href).split("/").pop())}`) }))
    .filter((l) => l.month);
  files.sort((a, b) => b.month - a.month || (/\.xlsx/i.test(b.href) ? 1 : 0) - (/\.xlsx/i.test(a.href) ? 1 : 0));
  return files[0] || null;
}

// the newest `months` monthly files, one per month (xlsx preferred), oldest first so the newest is loaded last
export function pickRecent(links, months = 6) {
  const out = [];
  let rest = links;
  while (out.length < months) {
    const f = pickLatest(rest);
    if (!f) break;
    out.push(f);
    rest = rest.filter((l) => monthOf(`${l.text} ${decodeURIComponent(String(l.href).split("/").pop())}`) !== f.month);
  }
  return out.reverse();
}

// MCA's site answers a bot check instead of the page
export const looksBlocked = (status, text) => status === 403 || status === 429 || /access denied|request unsuccessful|verify you are (a )?human|are you a robot|captcha|incapsula|akamai/i.test(String(text || "").slice(0, 5000));

// MCA's document list (/bin/dms/searchDocList, folder 403 = "Companies and LLPs registered in <Month>' <Year>"):
// documentDetails is JSON inside a JSON string. → [{ href, text }] download links for the registration files.
export function mcaDocLinks(body, base = "https://www.mca.gov.in") {
  let outer; try { outer = typeof body === "string" ? JSON.parse(body) : body; } catch { return []; }
  let items = outer?.documentDetails;
  if (typeof items === "string") { try { items = JSON.parse(items); } catch { return []; } }
  if (!Array.isArray(items)) return [];
  return items
    .filter((d) => d && d.docID && /registered/i.test(d.column1 || "") && !/struck|closed/i.test(d.column1 || ""))
    .map((d) => ({ href: `${base}/bin/dms/getdocument?mds=${d.docID}&type=open`, text: `${String(d.column1).replace(/\\u0027/g, "'")}.${(d.docType || "xlsx").toLowerCase()}` }));
}
