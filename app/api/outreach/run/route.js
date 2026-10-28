import { anonClient } from "@/lib/supabase/anon";
import { sendEmail, sendWhatsApp, sendInboxMessage, emailReady } from "@/lib/outreach";
import { onlineSlots, local, addDays } from "@/lib/scheduling";

export const maxDuration = 60;

// Called by pg_cron (via pg_net) every few minutes and right after a message is queued. The x-worker-key header
// is checked inside the database against the key in Supabase Vault; this route holds no secret of its own.
export async function POST(request) {
  const key = request.headers.get("x-worker-key") || "";
  if (!key) return new Response("forbidden", { status: 403 });
  const supabase = anonClient();
  const channels = ["whatsapp", ...(emailReady() ? ["email"] : [])];
  const { data: batch, error } = await supabase.rpc("outreach_claim", { p_key: key, p_channels: channels, p_limit: 40 });
  if (error) return new Response(/bad worker key/.test(error.message) ? "forbidden" : "error", { status: /bad worker key/.test(error.message) ? 403 : 500 });
  const origin = new URL(request.url).origin;
  const results = [];
  for (let i = 0; i < batch.length; i += 5) {
    results.push(...(await Promise.all(batch.slice(i, i + 5).map(async (m) => {
      try {
        const id = m.channel === "email" ? await sendEmail(m, origin) : await sendWhatsApp(m);
        return { id: m.id, ok: true, provider_id: id };
      } catch (e) {
        return { id: m.id, ok: false, error: e.message };
      }
    }))));
  }
  if (results.length) {
    const { error: e2 } = await supabase.rpc("outreach_report", { p_key: key, p_results: results });
    if (e2) console.error("outreach report", e2.message);
  }
  const links = await bookingLinks(supabase, key);
  const inbox = await inboxReplies(supabase, key);
  return Response.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, links, inbox });
}

// Lead Playbook "booking link" steps: work out the company's free times for the next 14 days (every salesperson,
// like a link made by hand) and hand them back; the database saves the link and queues the WhatsApp / email with it.
async function bookingLinks(supabase, key) {
  const { data: jobs, error } = await supabase.rpc("playbook_booking_claim", { p_key: key, p_limit: 10 });
  if (error) { console.error("booking claim", error.message); return 0; }
  let made = 0;
  for (const j of jobs || []) {
    let offered = null, err = null;
    try {
      const type = j.type;
      if (!type?.id) err = "no meeting type is set up (Sales team → Meeting types)";
      else if (type.mode !== "online") err = "booking links from a playbook offer online meetings; this meeting type is a field visit";
      else {
        const reps = (j.reps || []).map((r) => ({ ...r, day_start: String(r.day_start).slice(0, 5), day_end: String(r.day_end).slice(0, 5) }));
        if (!reps.some((r) => (r.modes || []).includes("online"))) err = "no salesperson takes online calls";
        else {
          const today = local(new Date()).day, slots = [];
          for (let i = 0; i < 14; i++) slots.push(...onlineSlots({ day: addDays(today, i), reps, meetings: j.meetings || [], duration: type.duration_min, buffer: type.buffer_min, all: true }));
          offered = slots.map((x) => ({ start: x.start.toISOString(), end: x.end.toISOString(), rep_id: x.rep_id, travel_in: null, leave_at: null }));
        }
      }
    } catch (e) { err = e.message; }
    const { error: e2 } = await supabase.rpc("playbook_booking_done", { p_key: key, p_id: j.id, p_offered: offered, p_error: err });
    if (e2) console.error("booking done", e2.message); else if (!err) made++;
  }
  return made;
}

// WhatsApp inbox: replies typed by the team (and auto-replies), sent from the workspace's own number.
async function inboxReplies(supabase, key) {
  const { data: msgs, error } = await supabase.rpc("wa_inbox_claim", { p_key: key, p_limit: 30 });
  if (error) { if (!/does not exist/.test(error.message)) console.error("inbox claim", error.message); return 0; }
  const results = [];
  for (const m of msgs || []) {
    try { results.push({ id: m.id, ok: true, provider_id: await sendInboxMessage(m) }); }
    catch (e) { results.push({ id: m.id, ok: false, error: e.message }); }
  }
  if (results.length) {
    const { error: e2 } = await supabase.rpc("wa_inbox_report", { p_key: key, p_results: results });
    if (e2) console.error("inbox report", e2.message);
  }
  return results.filter((r) => r.ok).length;
}
