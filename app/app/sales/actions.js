"use server";
import { revalidatePath } from "next/cache";
import { getContext } from "@/lib/session";
import { onlineSlots, fieldSlots, travelPairs, planVisits, addDays, local, leadAddress } from "@/lib/scheduling";
import { travelMinutes } from "@/lib/routes";

// Sales team: salespeople, meeting types, booking (by staff or by the client through a link) and the day plan.
const writer = (role) => !["admin", "manager"].includes(role) && { error: "Only admins and managers can change the sales team." };
const s = (v, n = 200) => String(v ?? "").trim().slice(0, n) || null;
const done = () => { revalidatePath("/app/sales", "layout"); };

export async function saveRep(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (writer(role)) return writer(role);
  const id = s(formData.get("id"), 40);
  const row = {
    tenant_id: tenant.id, company_id: company.id, name: s(formData.get("name"), 120), phone: s(formData.get("phone"), 20), email: s(formData.get("email"), 120),
    user_id: s(formData.get("user_id"), 40), modes: formData.getAll("modes").map(String).filter((m) => ["online", "field"].includes(m)),
    day_start: s(formData.get("day_start"), 5) || "09:30", day_end: s(formData.get("day_end"), 5) || "18:30",
    work_days: formData.getAll("work_days").map(Number).filter((d) => d >= 0 && d <= 6), start_address: s(formData.get("start_address"), 300),
    active: formData.get("active") !== "off",
  };
  if (!row.name) return { error: "Name is needed." };
  if (!row.modes.length) return { error: "Tick online calls, field visits or both." };
  if (!row.work_days.length) return { error: "Tick at least one working day." };
  if (row.day_end <= row.day_start) return { error: "The day must end after it starts." };
  if (row.modes.includes("field") && !row.start_address) return { error: "Field visits need a start point (office or home address)." };
  const { error } = id ? await supabase.from("sales_reps").update(row).eq("id", id).eq("company_id", company.id) : await supabase.from("sales_reps").insert(row);
  if (error) return { error: error.message };
  done();
  return { message: id ? "Saved." : `${row.name} added to the sales team.` };
}

export async function saveType(prev, formData) {
  const { supabase, tenant, company, role } = await getContext();
  if (writer(role)) return writer(role);
  const id = s(formData.get("id"), 40);
  const row = { tenant_id: tenant.id, company_id: company.id, name: s(formData.get("name"), 120), mode: formData.get("mode") === "field" ? "field" : "online",
    duration_min: Math.min(480, Math.max(5, Number(formData.get("duration_min")) || 30)), buffer_min: Math.min(120, Math.max(0, Number(formData.get("buffer_min")) || 0)), active: formData.get("active") !== "off" };
  if (!row.name) return { error: "Give the meeting type a name, e.g. “Online demo”." };
  const { error } = id ? await supabase.from("meeting_types").update(row).eq("id", id).eq("company_id", company.id) : await supabase.from("meeting_types").insert(row);
  if (error) return { error: error.message };
  done();
  return { message: "Saved." };
}

// Free slots for a meeting type over the next `days` days (online: packed days; field: routes with Google travel times).
// all: every free rep per time (for booking links); otherwise one rep per time.
async function slotsFor(supabase, tenant, company, type, address, { days = 7, from = local(new Date()).day, all = false } = {}) {
  const [{ data: reps }, { data: meetings }] = await Promise.all([
    supabase.from("sales_reps").select("*").eq("company_id", company.id).eq("active", true),
    supabase.from("meetings").select("id, rep_id, mode, address, starts_at, ends_at, buffer_min, status").eq("company_id", company.id).in("status", ["booked", "done"])
      .gte("starts_at", new Date(Date.now() - 86400000).toISOString()).lte("starts_at", new Date(Date.now() + (days + 2) * 86400000).toISOString()),
  ]);
  const list = (reps || []).map((r) => ({ ...r, day_start: String(r.day_start).slice(0, 5), day_end: String(r.day_end).slice(0, 5) }));
  if (!list.some((r) => r.modes.includes(type.mode))) return { error: `No active salesperson takes ${type.mode === "field" ? "field visits" : "online calls"} yet. Add one under Sales team → Salespeople.` };
  const out = [];
  let estimated = false, travelError = null;
  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    if (type.mode === "online") { out.push(...onlineSlots({ day, reps: list, meetings: meetings || [], duration: type.duration_min, buffer: type.buffer_min, all })); continue; }
    if (!address) return { error: "A field visit needs the client's address." };
    for (const rep of list.filter((r) => r.modes.includes("field"))) {
      const dayM = (meetings || []).filter((m) => m.rep_id === rep.id && local(m.starts_at).day === day);
      const t = await travelMinutes(supabase, tenant.id, travelPairs(rep, dayM, address));
      estimated ||= t.estimated;
      travelError ||= t.error;
      out.push(...fieldSlots({ day, rep, meetings: meetings || [], address, duration: type.duration_min, buffer: type.buffer_min, travel: t.travel }));
    }
  }
  // field: the rep whose day already passes nearby (least extra driving) comes first for each time
  const extra = (x) => x.detour ?? x.travel_in ?? 0;
  if (all) return { slots: out.sort((a, b) => a.start - b.start || extra(a) - extra(b)), estimated, travelError };
  const best = new Map();
  for (const x of out) { const k = x.start.toISOString(); if (!best.has(k) || extra(x) < extra(best.get(k))) best.set(k, x); }
  return { slots: [...best.values()].sort((a, b) => a.start - b.start), estimated, travelError };
}

export async function findSlots({ typeId, leadId, address, days = 7, limit = 160 }) {
  const { supabase, tenant, company } = await getContext();
  const { data: type } = await supabase.from("meeting_types").select("*").eq("id", typeId).eq("company_id", company.id).single();
  if (!type) return { error: "Choose a meeting type." };
  let addr = s(address, 300);
  if (type.mode === "field" && !addr && leadId) { const { data: lead } = await supabase.from("leads").select("address, notes, city, state").eq("id", leadId).single(); addr = leadAddress(lead || {}); }
  const r = await slotsFor(supabase, tenant, company, type, addr, { days });
  if (r.error) return r;
  const { data: reps } = await supabase.from("sales_reps").select("id, name").eq("company_id", company.id);
  const name = Object.fromEntries((reps || []).map((x) => [x.id, x.name]));
  return { address: addr, estimated: r.estimated, travelError: r.travelError, slots: r.slots.slice(0, limit).map((x) => ({ ...x, start: x.start.toISOString(), end: x.end.toISOString(), leave_at: x.leave_at?.toISOString() || null, rep: name[x.rep_id] })) };
}

// Staff book a slot directly (re-checked against the latest calendar).
export async function bookSlot({ typeId, leadId, start, repId, address, notes }) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot book meetings." };
  const { data: type } = await supabase.from("meeting_types").select("*").eq("id", typeId).eq("company_id", company.id).single();
  if (!type) return { error: "Choose a meeting type." };
  const r = await findSlots({ typeId, leadId, address, days: 14, limit: Infinity });
  if (r.error) return r;
  const slot = r.slots.find((x) => x.start === start && (!repId || x.rep_id === repId)) || r.slots.find((x) => x.start === start);
  if (!slot) return { error: "That time was just taken — pick another." };
  const { data: m, error } = await supabase.from("meetings").insert({ tenant_id: tenant.id, company_id: company.id, rep_id: slot.rep_id, lead_id: leadId || null, type_id: type.id, mode: type.mode, title: type.name,
    starts_at: slot.start, ends_at: slot.end, buffer_min: type.buffer_min, address: type.mode === "field" ? r.address : null, travel_min: slot.travel_in ?? null, leave_at: slot.leave_at, notes: s(notes, 500) }).select("id").single();
  if (error) return { error: error.message };
  if (leadId && type.mode === "field" && r.address) await supabase.from("leads").update({ address: r.address }).eq("id", leadId).is("address", null);
  // the CRM entry (timeline naming the salesperson, deal moved to "Meeting") is written by trigger t_meeting_crm
  done(); revalidatePath(`/app/leads/${leadId}`); revalidatePath("/app/crm");
  return { ok: true, id: m.id, message: `Booked with ${slot.rep} — ${new Date(slot.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}.` };
}

// A booking link for the client: the free times of the next 7 days are worked out now (travel included) and the
// client picks one; it is re-checked when they book.
export async function createBookingLink({ typeId, leadId, address }) {
  const { supabase, tenant, company, role } = await getContext();
  if (role === "viewer") return { error: "Viewers cannot send booking links." };
  const { data: type } = await supabase.from("meeting_types").select("*").eq("id", typeId).eq("company_id", company.id).single();
  if (!type) return { error: "Choose a meeting type." };
  let addr = s(address, 300);
  if (type.mode === "field" && !addr && leadId) { const { data: lead } = await supabase.from("leads").select("address, notes, city, state").eq("id", leadId).single(); addr = leadAddress(lead || {}); }
  // every free salesperson for every time, 14 days ahead: the client sees the company's free times, and the
  // booking goes to whoever is still free when they pick
  const r = await slotsFor(supabase, tenant, company, type, addr, { days: 14, all: true });
  if (r.error) return r;
  if (!r.slots.length) return { error: "No free times in the next 14 days — add salespeople or working hours." };
  const offered = r.slots.map(({ start, end, rep_id, travel_in, leave_at }) => ({ start: start.toISOString(), end: end.toISOString(), rep_id, travel_in: travel_in ?? null, leave_at: leave_at?.toISOString() || null }));
  const { data, error } = await supabase.from("booking_links").insert({ tenant_id: tenant.id, company_id: company.id, lead_id: leadId || null, type_id: typeId, address: addr || null, offered, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() }).select("token").single();
  if (error) return { error: error.message };
  return { ok: true, token: data.token, count: new Set(offered.map((x) => x.start)).size };
}

export async function setMeetingStatus(formData) {
  const { supabase, company, role } = await getContext();
  if (role === "viewer") return;
  const status = String(formData.get("status"));
  if (!["done", "cancelled", "no_show", "booked"].includes(status)) return;
  await supabase.from("meetings").update({ status }).eq("id", String(formData.get("id"))).eq("company_id", company.id);
  done();
}

// Plan several field visits on one day: every place of the day is priced once with Google (cache first), then the
// free planner shares the visits out so each salesperson drives as little as possible. Nothing is booked yet.
async function planFor(ctx, { day, typeId, leadIds }) {
  const { supabase, tenant, company } = ctx;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || "")) return { error: "Pick a day." };
  const ids = [...new Set((leadIds || []).map(String))].slice(0, 12);
  if (!ids.length) return { error: "Tick the clients to visit (up to 12)." };
  const [{ data: type }, { data: reps }, { data: meetings }, { data: leads }] = await Promise.all([
    supabase.from("meeting_types").select("*").eq("id", typeId).eq("company_id", company.id).maybeSingle(),
    supabase.from("sales_reps").select("*").eq("company_id", company.id).eq("active", true),
    supabase.from("meetings").select("id, rep_id, mode, address, starts_at, ends_at, buffer_min, status").eq("company_id", company.id).in("status", ["booked", "done"])
      .gte("starts_at", new Date(Date.parse(`${day}T00:00:00+05:30`)).toISOString()).lt("starts_at", new Date(Date.parse(`${day}T00:00:00+05:30`) + 86400000).toISOString()),
    supabase.from("leads").select("id, name, address, notes, city, state").in("id", ids).eq("company_id", company.id),
  ]);
  if (!type || type.mode !== "field") return { error: "Choose a field-visit meeting type." };
  const field = (reps || []).filter((r) => r.modes.includes("field")).map((r) => ({ ...r, day_start: String(r.day_start).slice(0, 5), day_end: String(r.day_end).slice(0, 5) }));
  if (!field.length) return { error: "No salesperson takes field visits yet. Add one under Salespeople." };
  const visits = (leads || []).map((l) => ({ id: l.id, name: l.name, address: leadAddress(l) })).filter((v) => v.address);
  const places = [...new Set([...field.map((r) => r.start_address), ...(meetings || []).map((m) => m.address), ...visits.map((v) => v.address)].filter(Boolean))].slice(0, 25);
  const pairs = places.flatMap((a) => places.filter((b) => b !== a).map((b) => [a, b]));
  const t = await travelMinutes(supabase, tenant.id, pairs);
  const r = planVisits({ day, reps: field, meetings: meetings || [], visits, duration: type.duration_min, buffer: type.buffer_min, travel: t.travel });
  const name = Object.fromEntries(field.map((x) => [x.id, x.name]));
  const lead = Object.fromEntries(visits.map((v) => [v.id, v]));
  return {
    type, estimated: t.estimated, travelError: t.error || null,
    plan: r.plan.map((p) => ({ lead_id: p.id, lead: lead[p.id].name, address: lead[p.id].address, rep_id: p.rep_id, rep: name[p.rep_id], start: p.start.toISOString(), end: p.end.toISOString(), leave_at: p.leave_at.toISOString(), travel_in: p.travel_in, detour: p.detour })),
    unplaced: [...r.unplaced.map((id) => lead[id].name), ...(leads || []).filter((l) => !leadAddress(l)).map((l) => `${l.name} (no address)`)],
  };
}

export async function planDay({ day, typeId, leadIds }) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot plan visits." };
  return planFor(ctx, { day, typeId, leadIds });
}

// Book the plan: worked out again on the latest calendar (so nothing double-books), then every visit is saved; the
// CRM entries follow by trigger.
export async function bookPlan({ day, typeId, leadIds }) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot book meetings." };
  const r = await planFor(ctx, { day, typeId, leadIds });
  if (r.error) return r;
  if (!r.plan.length) return { error: "None of these visits fits that day any more." };
  const { error } = await ctx.supabase.from("meetings").insert(r.plan.map((p) => ({
    tenant_id: ctx.tenant.id, company_id: ctx.company.id, rep_id: p.rep_id, lead_id: p.lead_id, type_id: r.type.id, mode: "field", title: r.type.name,
    starts_at: p.start, ends_at: p.end, buffer_min: r.type.buffer_min, address: p.address, travel_min: p.travel_in, leave_at: p.leave_at,
  })));
  if (error) return { error: error.message };
  done(); revalidatePath("/app/crm");
  return { ok: true, booked: r.plan.length, unplaced: r.unplaced };
}
