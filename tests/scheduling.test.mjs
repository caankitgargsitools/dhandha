import { test } from "node:test";
import assert from "node:assert/strict";
import { onlineSlots, fieldSlots, dayPlan, planVisits, at, local, hhmm, pairKey, travelPairs, leadAddress, groupSlots } from "../lib/scheduling.js";

const DAY = "2026-10-26"; // a Monday
const BEFORE = new Date("2026-10-25T10:00:00+05:30");
const reps = [
  { id: "a", day_start: "09:30", day_end: "12:00", modes: ["online"], work_days: [1, 2, 3, 4, 5] },
  { id: "b", day_start: "10:00", day_end: "11:30", modes: ["online", "field"], work_days: [1, 2, 3, 4, 5, 6], start_address: "Office, Gurugram" },
];
const t = (s) => local(s.start).min;

test("India time helpers", () => {
  assert.equal(at(DAY, 570).toISOString(), "2026-10-26T04:00:00.000Z");
  assert.deepEqual(local("2026-10-26T04:00:00Z"), { day: DAY, min: 570 });
  assert.equal(hhmm(570), "09:30");
});

test("online days are packed: meeting, break, meeting — around what is already booked", () => {
  const meetings = [{ rep_id: "a", starts_at: at(DAY, 650), ends_at: at(DAY, 680), status: "booked" }]; // 10:50-11:20
  const slots = onlineSlots({ day: DAY, reps: [reps[0]], meetings, duration: 30, buffer: 10, now: BEFORE });
  assert.deepEqual(slots.map((s) => hhmm(t(s))), ["09:30", "10:10", "11:30"]); // 10:10-10:40 + 10 min break fits before 10:50
  // nothing on a Sunday for rep a
  assert.equal(onlineSlots({ day: "2026-10-25", reps: [reps[0]], now: new Date("2026-10-24T08:00:00+05:30") }).length, 0);
});

test("the free rep with fewer meetings gets the slot; past times are not offered", () => {
  const meetings = [{ rep_id: "a", starts_at: at(DAY, 570), ends_at: at(DAY, 600), status: "booked" }];
  const slots = onlineSlots({ day: DAY, reps, meetings, duration: 30, buffer: 10, now: BEFORE });
  const ten = slots.find((s) => hhmm(t(s)) === "10:00");
  assert.equal(ten.rep_id, "b");
  const late = onlineSlots({ day: DAY, reps, duration: 30, buffer: 10, now: new Date("2026-10-26T10:45:00+05:30") });
  assert.ok(late.every((s) => t(s) >= 645 + 30));
});

test("field visits fit between meetings with travel both ways", () => {
  const rep = { id: "f", day_start: "09:30", day_end: "18:30", modes: ["field"], work_days: [1], start_address: "Office" };
  const meetings = [{ rep_id: "f", mode: "field", address: "Client A", starts_at: at(DAY, 720), ends_at: at(DAY, 750), status: "booked" }]; // 12:00-12:30
  const travel = { [pairKey("Office", "New")]: 45, [pairKey("New", "Client A")]: 20, [pairKey("Client A", "New")]: 20 };
  const slots = fieldSlots({ day: DAY, rep, meetings, address: "New", duration: 30, buffer: 10, travel, now: BEFORE });
  // leave office 9:30, drive 45 → 10:15–10:45, then 10 min + 20 min drive reaches Client A by 11:15 (< 12:00)
  assert.equal(hhmm(t(slots[0])), "10:15");
  assert.equal(hhmm(local(slots[0].leave_at).min), "09:30");
  // before Client A the choice is 10:15 or 10:45 (11:15 would miss the drive to Client A); after it, 12:30 + 10 + 20 drive = 13:00, then every 30 min
  assert.deepEqual(slots.slice(0, 4).map((s) => hhmm(t(s))), ["10:15", "10:45", "13:00", "13:30"]);
  assert.equal(hhmm(t(slots.at(-1))), "18:00");
  // a 2-hour visit cannot fit before Client A
  assert.equal(fieldSlots({ day: DAY, rep, meetings, address: "New", duration: 120, travel, now: BEFORE }).map((s) => hhmm(t(s)))[0], "13:00");
  assert.equal(travelPairs(rep, meetings, "New").length, 5); // to and from each place + office → Client A
});

test("day plan shows when to leave and the drive for each visit", () => {
  const rep = { id: "f", day_start: "09:30", start_address: "Office" };
  const meetings = [
    { rep_id: "f", mode: "field", address: "Client A", starts_at: at(DAY, 615), ends_at: at(DAY, 645), travel_min: 45, status: "booked" },
    { rep_id: "f", mode: "online", starts_at: at(DAY, 700), ends_at: at(DAY, 730), status: "booked" },
    { rep_id: "f", mode: "field", address: "Client B", starts_at: at(DAY, 780), ends_at: at(DAY, 810), status: "booked" },
  ];
  const plan = dayPlan({ day: DAY, rep, meetings, travel: { [pairKey("Client A", "Client B")]: 25 } });
  assert.deepEqual(plan.map((p) => [p.start, p.leave, p.from]), [["10:15", "09:30", "Office"], ["11:40", null, null], ["13:00", "12:35", "Client A"]]);
});

test("lead address and client-facing grouping", () => {
  assert.equal(leadAddress({ notes: "Address: Plot 5, Sector 18, Gurugram, Haryana\nGoogle rating 4.5" }), "Plot 5, Sector 18, Gurugram, Haryana");
  assert.equal(leadAddress({ city: "Rewari", state: "Haryana" }), "Rewari, Haryana");
  const g = groupSlots([{ start: at(DAY, 600) }, { start: at(DAY, 840) }, { start: at("2026-10-27", 1000) }]);
  assert.equal(g.length, 2);
  assert.equal(g[0].parts.Morning[0].label, "10:00");
  assert.equal(g[0].parts.Afternoon[0].label, "14:00");
  assert.equal(g[1].parts.Evening.length, 1);
});

test("booking links keep every free rep per time, so a time stays open while anyone is free", () => {
  const two = [reps[0], { ...reps[0], id: "c" }];
  const busyA = [{ rep_id: "a", starts_at: at(DAY, 570), ends_at: at(DAY, 600), status: "booked" }]; // a is busy 09:30-10:00
  const one = onlineSlots({ day: DAY, reps: two, duration: 30, buffer: 10, now: BEFORE });
  const all = onlineSlots({ day: DAY, reps: two, meetings: busyA, duration: 30, buffer: 10, now: BEFORE, all: true });
  assert.equal(new Set(one.map((s) => s.start.toISOString())).size, one.length); // one rep per time
  assert.deepEqual(all.filter((s) => hhmm(t(s)) === "09:30").map((s) => s.rep_id), ["c"]); // 09:30 still offered: c is free
  const at1050 = all.filter((s) => hhmm(t(s)) === "10:50").map((s) => s.rep_id);
  assert.equal(at1050.length, 2);
  assert.equal(at1050[0], "c"); // least-loaded first
});

test("an empty field day offers a choice of visit times, not just the first", () => {
  const rep = reps[1]; // 10:00-11:30, start point set
  const out = fieldSlots({ day: DAY, rep, address: "Client, Noida", duration: 30, buffer: 10, travel: {}, fallback: 15, now: BEFORE });
  assert.deepEqual(out.map((s) => hhmm(t(s))), ["10:15", "10:45"]); // 11:15 would end after 11:30
  assert.ok(out.every((s) => s.travel_in === 15));
});

test("route-aware: the rep already visiting the area adds the least driving and gets the visit", () => {
  const ra = { id: "ra", day_start: "09:30", day_end: "18:30", modes: ["field"], work_days: [1], start_address: "Office Delhi" };
  const rb = { id: "rb", day_start: "09:30", day_end: "18:30", modes: ["field"], work_days: [1], start_address: "Office Delhi" };
  const meetings = [{ rep_id: "ra", mode: "field", address: "Sector 3 Noida", starts_at: at(DAY, 660), ends_at: at(DAY, 705), status: "booked" }]; // ra in Sector 3, 11:00-11:45
  const travel = { [pairKey("Office Delhi", "Sector 4 Noida")]: 50, [pairKey("Sector 4 Noida", "Office Delhi")]: 50, [pairKey("Sector 3 Noida", "Sector 4 Noida")]: 10, [pairKey("Sector 4 Noida", "Sector 3 Noida")]: 10, [pairKey("Office Delhi", "Sector 3 Noida")]: 50 };
  const after = (rep) => fieldSlots({ day: DAY, rep, meetings, address: "Sector 4 Noida", duration: 30, buffer: 10, travel, now: BEFORE }).find((s) => hhmm(t(s)) >= "12:00");
  assert.equal(after(ra).travel_in, 10); // straight from Sector 3
  assert.equal(after(ra).detour, 10);
  assert.equal(after(rb).detour, 50); // from the office
  assert.ok(after(ra).detour < after(rb).detour);
  // the drive between consecutive stops is priced too
  assert.ok(travelPairs(ra, meetings, "Sector 4 Noida").some(([a, b]) => a === "Office Delhi" && b === "Sector 3 Noida"));
});

test("plan visits: nearby clients go to the same rep in a sensible order; what cannot fit is reported", () => {
  const rA = { id: "A", day_start: "09:30", day_end: "13:00", modes: ["field"], work_days: [1], start_address: "Noida" };
  const rB = { id: "B", day_start: "09:30", day_end: "13:00", modes: ["field"], work_days: [1], start_address: "Gurugram" };
  const places = ["Noida", "Gurugram", "N1", "N2", "G1"];
  const near = (a, b) => (a[0] === b[0] ? 10 : 60); // same first letter = same side of town
  const travel = {};
  for (const a of places) for (const b of places) if (a !== b) travel[pairKey(a, b)] = near(a, b);
  const { plan, unplaced } = planVisits({ day: DAY, reps: [rA, rB], visits: [{ id: "n1", address: "N1" }, { id: "g1", address: "G1" }, { id: "n2", address: "N2" }], duration: 45, buffer: 10, travel, now: BEFORE });
  assert.deepEqual(unplaced, []);
  assert.deepEqual(plan.filter((p) => p.rep_id === "A").map((p) => p.id).sort(), ["n1", "n2"]);
  assert.deepEqual(plan.filter((p) => p.rep_id === "B").map((p) => p.id), ["g1"]);
  const a = plan.filter((p) => p.rep_id === "A");
  assert.ok(a[1].start >= new Date(a[0].end.getTime() + 10 * 60000 + 10 * 60000)); // break + drive between them
  // a 3-hour visit fits nobody's morning
  assert.deepEqual(planVisits({ day: DAY, reps: [rA], visits: [{ id: "x", address: "N1" }], duration: 240, travel, now: BEFORE }).unplaced, ["x"]);
});
