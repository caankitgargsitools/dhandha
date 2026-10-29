// Calendar feed (C39; pure, tested): events → an iCalendar (.ics) file that Google Calendar, Outlook and phone
// calendars subscribe to by link. Timed events in UTC; dates as all-day events. RFC 5545 escaping and line folding.

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ymd = (d) => String(d).slice(0, 10).replace(/-/g, "");
const nextDay = (d) => { const x = new Date(`${String(d).slice(0, 10)}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10).replace(/-/g, ""); };

// fold lines longer than 75 octets (UTF-8), continuation lines start with a space
export function fold(line) {
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function toIcs(events = [], { name = "Dhandha", now = new Date() } = {}) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dhandha//Bid calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`, "X-WR-TIMEZONE:Asia/Kolkata", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  for (const e of events) {
    const timed = !e.all_day && e.at && !Number.isNaN(Date.parse(e.at));
    const day = e.all_day ? e.date || e.at : null;
    if (!timed && !(day && /^\d{4}-\d{2}-\d{2}/.test(String(day)))) continue;
    lines.push("BEGIN:VEVENT", `UID:${esc(e.uid)}@dhandha`, `DTSTAMP:${utc(now)}`);
    if (timed) { lines.push(`DTSTART:${utc(e.at)}`, `DTEND:${utc(new Date(Date.parse(e.at) + 30 * 60000))}`); }
    else lines.push(`DTSTART;VALUE=DATE:${ymd(day)}`, `DTEND;VALUE=DATE:${nextDay(day)}`);
    lines.push(`SUMMARY:${esc(String(e.title || "").slice(0, 250))}`);
    if (e.where) lines.push(`LOCATION:${esc(e.where)}`);
    const desc = [e.note, e.url].filter(Boolean).join("\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc.slice(0, 1000))}`);
    if (e.url && /^https?:\/\//.test(e.url)) lines.push(`URL:${e.url.replace(/[\r\n]/g, "")}`);
    if (timed) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:-PT24H", "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
