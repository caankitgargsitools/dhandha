// Field visit proof (pure, tested): GPS check-ins and check-outs at client meetings (visit_checkins) turned into
// visits with time spent, the straight-line distance between stops and the day's total, free (no maps API).

export function haversineM(a, b) {
  if (!a || !b) return 0;
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

// check-ins of one person → visits in time order: { meeting_id, in, out, minutes, from_prev_m }
export function pairVisits(checkins = []) {
  const rows = [...checkins].sort((a, b) => new Date(a.at) - new Date(b.at));
  const visits = [];
  const open = new Map();
  for (const c of rows) {
    if (c.kind === "in") {
      const v = { meeting_id: c.meeting_id, lead_id: c.lead_id, in: c, out: null, minutes: null };
      visits.push(v); open.set(c.meeting_id, v);
    } else if (open.has(c.meeting_id)) {
      const v = open.get(c.meeting_id);
      v.out = c; v.minutes = Math.max(1, Math.round((new Date(c.at) - new Date(v.in.at)) / 60000));
      open.delete(c.meeting_id);
    }
  }
  let prev = null;
  for (const v of visits) { v.from_prev_m = prev ? haversineM(prev, v.in) : null; prev = v.out || v.in; }
  return visits;
}

// straight-line km between consecutive GPS points of the day (roads are longer — a floor, not a claim)
export function dayDistanceKm(checkins = []) {
  const rows = [...checkins].sort((a, b) => new Date(a.at) - new Date(b.at));
  let m = 0;
  for (let i = 1; i < rows.length; i++) m += haversineM(rows[i - 1], rows[i]);
  return Math.round(m / 100) / 10;
}

export const mapLink = (c) => (c ? `https://www.google.com/maps?q=${c.lat},${c.lng}` : null);

// a GPS fix worse than this is shown as "rough"
export const ROUGH_M = 200;
