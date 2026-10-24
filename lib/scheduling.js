// Salesperson scheduling. Times are India time (UTC+5:30, no daylight saving): a day is "YYYY-MM-DD" and a
// time of day is minutes from midnight. Pure functions — used by pages, actions and `node --test`.
//   Online calls: each salesperson's day is packed — meeting, break (buffer), next meeting — from day start.
//   Field visits: a day is a route — start point → client → client …; a visit fits a gap only if there is time to
//   drive there, hold the meeting, and still reach the next one on time.

const IST = 330; // minutes ahead of UTC
export const toMin = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
// a day + minutes (India time) → a Date
export const at = (day, min) => new Date(Date.parse(`${day}T00:00:00Z`) + (min - IST) * 60000);
// a Date → { day, min } in India time
export function local(d) {
  const t = new Date(new Date(d).getTime() + IST * 60000);
  return { day: t.toISOString().slice(0, 10), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}
export const weekday = (day) => new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 Sunday … 6 Saturday
export const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const ceilTo = (min, step) => Math.ceil(min / step) * step;

const works = (rep, day, mode) => rep.active !== false && (rep.modes || ["online", "field"]).includes(mode) && (rep.work_days || [1, 2, 3, 4, 5, 6]).includes(weekday(day));
// a rep's meetings that day as [start, end] minutes, sorted
function busy(meetings, repId, day) {
  return meetings.filter((m) => m.rep_id === repId && m.status !== "cancelled" && local(m.starts_at).day === day)
    .map((m) => ({ ...m, s: local(m.starts_at).min, e: local(m.ends_at).min })).sort((a, b) => a.s - b.s);
}

// Online slots for one day: for every rep, the chain day-start → meeting → buffer → meeting …, stepping past
// existing meetings (each keeps its buffer). Returns [{ start, end, rep_id }] (Dates), earliest first; one rep per
// time — the one with the fewest meetings that day, so the team's days fill evenly.
// all: keep every free rep per time (least-loaded first) — booking links offer the company's times, not one person's.
export function onlineSlots({ day, reps, meetings = [], duration = 30, buffer = 10, now = new Date(), leadMin = 30, all = false }) {
  const nowL = local(now);
  const earliest = nowL.day === day ? nowL.min + leadMin : nowL.day > day ? Infinity : 0;
  const byTime = new Map();
  for (const rep of reps) {
    if (!works(rep, day, "online")) continue;
    const list = busy(meetings, rep.id, day);
    const dayEnd = toMin(rep.day_end || "18:30");
    let t = Math.max(toMin(rep.day_start || "09:30"), ceilTo(earliest, 5));
    while (t + duration <= dayEnd) {
      const clash = list.find((m) => t < m.e + buffer && m.s < t + duration + buffer);
      if (clash) { t = clash.e + buffer; continue; }
      const load = list.length;
      byTime.set(t, [...(byTime.get(t) || []), { start: at(day, t), end: at(day, t + duration), rep_id: rep.id, load }].sort((a, b) => a.load - b.load));
      t += duration + buffer;
    }
  }
  return [...byTime.entries()].sort((a, b) => a[0] - b[0]).flatMap(([, v]) => (all ? v : v.slice(0, 1)).map((x) => ({ start: x.start, end: x.end, rep_id: x.rep_id })));
}

// The trips a field visit at `address` needs priced: from each stop of the day to it and from it to each stop.
export function travelPairs(rep, dayMeetings, address) {
  const stops = [rep.start_address, ...dayMeetings.map((m) => m.address)].filter(Boolean);
  const pairs = [];
  for (const s of new Set(stops)) { pairs.push([s, address]); pairs.push([address, s]); }
  return pairs;
}
export const pairKey = (a, b) => `${String(a).trim().toLowerCase()}→${String(b).trim().toLowerCase()}`;

// Field slots for one rep and one day. travel: { [pairKey(from, to)]: minutes } (missing pairs use `fallback`).
// Each gap of the day's route — start point → meeting → … → end of day — offers a choice of start times: from the
// earliest the rep can get there (rounded up to 5 min), every `step` minutes, as long as the visit still leaves time
// to reach the next meeting (or ends by the end of the day). Returns [{ start, end, rep_id, travel_in, leave_at, travel_out }].
export function fieldSlots({ day, rep, meetings = [], address, duration = 30, buffer = 10, travel = {}, fallback = 45, now = new Date(), leadMin = 120, step = 30 }) {
  if (!works(rep, day, "field") || !address) return [];
  const nowL = local(now);
  const earliest = nowL.day === day ? nowL.min + leadMin : nowL.day > day ? Infinity : 0;
  const tr = (a, b) => (a && b ? travel[pairKey(a, b)] ?? fallback : 0);
  const list = busy(meetings, rep.id, day);
  const dayStart = toMin(rep.day_start || "09:30"), dayEnd = toMin(rep.day_end || "18:30");
  const stops = [{ e: dayStart, address: rep.start_address }, ...list];
  const out = [];
  for (let i = 0; i < stops.length; i++) {
    const prev = stops[i], next = list[i] || null; // stops[i+1] === list[i]
    const tin = tr(prev.address, address);
    const tout = next ? tr(address, next.address) : 0;
    const latest = next ? next.s - buffer - tout - duration : dayEnd - duration;
    for (let start = ceilTo(Math.max(prev.e + (i ? buffer : 0) + tin, earliest + tin), 5); start <= latest; start += step) {
      out.push({ start: at(day, start), end: at(day, start + duration), rep_id: rep.id, travel_in: tin, leave_at: at(day, start - tin), travel_out: tout });
    }
  }
  return out;
}

// A rep's day as a route: each meeting with when to leave the previous place and how long the drive is.
export function dayPlan({ day, rep, meetings = [], travel = {}, fallback = 45 }) {
  const list = busy(meetings, rep.id, day);
  let place = rep.start_address, free = toMin(rep.day_start || "09:30");
  return list.map((m) => {
    const drive = m.mode === "field" ? (m.travel_min ?? travel[pairKey(place, m.address)] ?? (place && m.address ? fallback : 0)) : 0;
    const row = { ...m, start: hhmm(m.s), end: hhmm(m.e), drive, leave: m.mode === "field" ? hhmm(m.s - drive) : null, from: m.mode === "field" ? place : null, idle: Math.max(0, m.s - drive - free) };
    if (m.mode === "field") place = m.address;
    free = m.e;
    return row;
  });
}

// Google Maps directions link from one place to another (opens the app on a phone).
export const directionsUrl = (from, to) => `https://www.google.com/maps/dir/?api=1&travelmode=driving${from ? `&origin=${encodeURIComponent(from)}` : ""}&destination=${encodeURIComponent(to || "")}`;

// The address a lead's field visit goes to: its address, else the "Address:" line Google Maps leads carry in notes,
// else city + state.
export function leadAddress(lead = {}) {
  if (lead.address) return lead.address;
  const m = String(lead.notes || "").match(/Address:\s*(.+)/);
  if (m) return m[1].trim();
  return [lead.city, lead.state].filter(Boolean).join(", ");
}

// Slots grouped for a client: by day, then morning / afternoon / evening (the client's preferred time).
export function groupSlots(slots) {
  const days = new Map();
  for (const s of slots) {
    const { day, min } = local(s.start);
    const part = min < 720 ? "Morning" : min < 960 ? "Afternoon" : "Evening";
    if (!days.has(day)) days.set(day, { Morning: [], Afternoon: [], Evening: [] });
    days.get(day)[part].push({ ...s, label: hhmm(min) });
  }
  return [...days.entries()].map(([day, parts]) => ({ day, parts }));
}
