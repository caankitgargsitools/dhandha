import { test } from "node:test";
import assert from "node:assert/strict";
import { haversineM, pairVisits, dayDistanceKm, mapLink } from "../lib/visits.js";

const p = (meeting_id, kind, at, lat, lng) => ({ meeting_id, kind, at, lat, lng });

test("distance between two points", () => {
  // Connaught Place → India Gate is about 2.4 km
  const d = haversineM({ lat: 28.6315, lng: 77.2167 }, { lat: 28.6129, lng: 77.2295 });
  assert.ok(d > 2200 && d < 2600, String(d));
  assert.equal(haversineM(null, { lat: 1, lng: 1 }), 0);
});

test("visits paired with time spent and distance from the last stop", () => {
  const rows = [
    p("m2", "in", "2026-10-28T08:00:00Z", 28.6129, 77.2295),
    p("m1", "out", "2026-10-28T06:45:00Z", 28.6315, 77.2167),
    p("m1", "in", "2026-10-28T06:00:00Z", 28.6315, 77.2167),
    p("m3", "out", "2026-10-28T09:00:00Z", 0, 0), // out without in is ignored
  ];
  const v = pairVisits(rows);
  assert.equal(v.length, 2);
  assert.equal(v[0].meeting_id, "m1");
  assert.equal(v[0].minutes, 45);
  assert.equal(v[0].from_prev_m, null);
  assert.ok(v[1].from_prev_m > 2200);
  assert.equal(v[1].out, null);
  assert.equal(dayDistanceKm(rows.slice(0, 3)), 2.4);
  assert.equal(mapLink({ lat: 1.5, lng: 2 }), "https://www.google.com/maps?q=1.5,2");
});
