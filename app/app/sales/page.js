import Link from "next/link";
import { getContext } from "@/lib/session";
import { local, addDays, hhmm, at, leadAddress } from "@/lib/scheduling";
import BookForLead from "@/components/BookForLead";
import { setMeetingStatus } from "./actions";

const STATUS = { booked: ["info", "Booked"], done: ["ok", "Done"], cancelled: ["mute", "Cancelled"], no_show: ["bad", "No-show"] };

// Team calendar: one column per salesperson for the chosen day, meetings in time order with drive times.
export default async function TeamCalendar({ searchParams }) {
  const sp = await searchParams;
  const today = local(new Date()).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp?.date || "") ? sp.date : today;
  const { supabase, company, role } = await getContext();
  const [{ data: reps }, { data: meetings }, { data: types }, { data: leads }, { data: upcoming }] = await Promise.all([
    supabase.from("sales_reps").select("*").eq("company_id", company.id).eq("active", true).order("name"),
    supabase.from("meetings").select("*, leads(id, name, contact_person, phone)").eq("company_id", company.id).gte("starts_at", at(day, 0).toISOString()).lt("starts_at", at(day, 1440).toISOString()).order("starts_at"),
    supabase.from("meeting_types").select("id, name, mode, duration_min, buffer_min").eq("company_id", company.id).eq("active", true).order("name"),
    supabase.from("leads").select("id, name, contact_person, phone, city, state, address, notes").eq("company_id", company.id).order("updated_at", { ascending: false }).limit(300),
    supabase.from("meetings").select("id, title, mode, starts_at, booked_via, address, sales_reps(name), leads(id, name)").eq("company_id", company.id).eq("status", "booked")
      .gte("starts_at", new Date().toISOString()).lte("starts_at", new Date(Date.now() + 14 * 86400000).toISOString()).order("starts_at").limit(50),
  ]);
  const canWrite = role !== "viewer";
  const label = new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  return (
    <>
      <div className="page-head">
        <div><h1>Team calendar</h1><p>{label}{day === today ? " · today" : ""}</p></div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn sm ghost" href={`/app/sales?date=${addDays(day, -1)}`}>← Previous</Link>
          {day !== today && <Link className="btn sm ghost" href="/app/sales">Today</Link>}
          <Link className="btn sm ghost" href={`/app/sales?date=${addDays(day, 1)}`}>Next →</Link>
        </div>
      </div>
      {canWrite && (
        <details className="panel" open={!!reps?.length && !!types?.length}>
          <summary style={{ cursor: "pointer" }}><strong>Book a meeting</strong> <span className="small muted">— find a free time, or send the client a link to pick one</span></summary>
          <div style={{ marginTop: 12 }}>
            {!types?.length || !reps?.length
              ? <p className="small muted" style={{ margin: 0 }}>First add {!types?.length ? <Link href="/app/sales/types">a meeting type</Link> : null}{!types?.length && !reps?.length ? " and " : ""}{!reps?.length ? <Link href="/app/sales/team">a salesperson</Link> : null}.</p>
              : <BookForLead leads={(leads || []).map((l) => ({ id: l.id, name: l.name, contact_person: l.contact_person, phone: l.phone, city: l.city, address: leadAddress(l) }))} types={types} business={company.name} />}
          </div>
        </details>
      )}
      {!!upcoming?.length && (
        <div className="panel flush table-wrap">
          <div className="panel-head" style={{ padding: "14px 16px 0" }}><h3>Coming up · next 14 days</h3><span className="tiny faint">{upcoming.length} booked</span></div>
          <table>
            <thead><tr><th>When</th><th>Meeting</th><th>Client</th><th>Salesperson</th><th>Booked by</th></tr></thead>
            <tbody>
              {upcoming.map((m) => (
                <tr key={m.id}>
                  <td className="num"><Link href={`/app/sales?date=${local(m.starts_at).day}`}>{new Date(m.starts_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Link></td>
                  <td>{m.title} <span className="tiny faint">{m.mode === "field" ? "visit" : "online"}</span></td>
                  <td>{m.leads ? <Link href={`/app/leads/${m.leads.id}`}>{m.leads.name}</Link> : "—"}</td>
                  <td>{m.sales_reps?.name || "—"}</td>
                  <td><span className={`chip ${m.booked_via === "client_link" ? "ok" : "mute"} plain`}>{m.booked_via === "client_link" ? "Client, via link" : "Team"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!reps?.length && <div className="panel small muted">No salespeople yet. <Link href="/app/sales/team">Add your sales team</Link> and their working hours, then book meetings from any lead.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {(reps || []).map((r) => {
          const mine = (meetings || []).filter((m) => m.rep_id === r.id);
          const live = mine.filter((m) => m.status !== "cancelled");
          const booked = live.reduce((s, m) => s + (new Date(m.ends_at) - new Date(m.starts_at)) / 60000 + (m.travel_min || 0), 0);
          const avail = Math.max(1, (Number(String(r.day_end).slice(0, 2)) * 60 + Number(String(r.day_end).slice(3, 5))) - (Number(String(r.day_start).slice(0, 2)) * 60 + Number(String(r.day_start).slice(3, 5))));
          return (
            <div key={r.id} className="panel stack-sm" style={{ padding: 16 }}>
              <div className="row between">
                <div><strong>{r.name}</strong><div className="tiny faint">{String(r.day_start).slice(0, 5)}–{String(r.day_end).slice(0, 5)} · {r.modes.map((m) => (m === "field" ? "visits" : "online")).join(" + ")}</div></div>
                <Link className="btn sm ghost" href={`/app/sales/day?rep=${r.id}&date=${day}`}>Day plan</Link>
              </div>
              <div className="bar" title={`${Math.round((booked / avail) * 100)}% of the day booked`}><span style={{ width: `${Math.min(100, (booked / avail) * 100)}%` }} /></div>
              {!mine.length && <p className="tiny faint" style={{ margin: 0 }}>Free all day.</p>}
              {mine.map((m) => {
                const [cls, txt] = STATUS[m.status];
                return (
                  <div key={m.id} style={{ borderLeft: `3px solid ${m.mode === "field" ? "var(--violet)" : "var(--primary)"}`, paddingLeft: 10, opacity: m.status === "cancelled" ? 0.5 : 1 }}>
                    <div className="row between small"><strong className="num">{hhmm(local(m.starts_at).min)}–{hhmm(local(m.ends_at).min)}</strong><span className={`chip ${cls}`}>{txt}</span></div>
                    <div className="small">{m.title}{m.leads ? <> · <Link href={`/app/leads/${m.leads.id}`}>{m.leads.name}</Link></> : null}</div>
                    {m.mode === "field" && <div className="tiny faint">{m.travel_min ? `${m.travel_min} min drive · ` : ""}{m.address}</div>}
                    {canWrite && m.status === "booked" && (
                      <div className="row" style={{ gap: 4, marginTop: 4 }}>
                        {[["done", "Done"], ["no_show", "No-show"], ["cancelled", "Cancel"]].map(([st, l]) => (
                          <form key={st} action={setMeetingStatus}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="status" value={st} /><button className="sm ghost" style={{ padding: "3px 8px", fontSize: 12 }}>{l}</button></form>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
