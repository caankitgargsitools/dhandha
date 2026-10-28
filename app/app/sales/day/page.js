import Link from "next/link";
import { getContext } from "@/lib/session";
import { local, addDays, at, dayPlan, directionsUrl } from "@/lib/scheduling";
import { setMeetingStatus } from "../actions";
import { telLink } from "@/lib/leads";
import SubmitButton from "@/components/SubmitButton";

// A salesperson's day as a route: when to leave, the drive, the meeting, directions — in order.
export default async function MyDay({ searchParams }) {
  const sp = await searchParams;
  const today = local(new Date()).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp?.date || "") ? sp.date : today;
  const { supabase, company, user, role } = await getContext();
  const { data: reps } = await supabase.from("sales_reps").select("*").eq("company_id", company.id).eq("active", true).order("name");
  const isLead = ["admin", "manager"].includes(role);
  // only admins and managers may look at someone else's day
  const rep = (isLead && (reps || []).find((r) => r.id === sp?.rep)) || (reps || []).find((r) => r.user_id === user.id) || (isLead ? reps?.[0] : null);
  if (!rep) return <div className="panel small muted">You are not on the sales team yet. An admin can add you under <Link href="/app/sales/team">Salespeople</Link>.</div>;
  const { data: meetings } = await supabase.from("meetings").select("*, leads(id, name, contact_person, phone)").eq("rep_id", rep.id).neq("status", "cancelled")
    .gte("starts_at", at(day, 0).toISOString()).lt("starts_at", at(day, 1440).toISOString()).order("starts_at");
  const plan = dayPlan({ day, rep: { ...rep, day_start: String(rep.day_start).slice(0, 5) }, meetings: meetings || [] });
  const label = new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });
  const q = (o) => new URLSearchParams({ rep: rep.id, date: day, ...o }).toString();
  return (
    <>
      <div className="page-head">
        <div><h1>{rep.user_id === user.id ? "My day" : `${rep.name}'s day`}</h1><p>{label} · starts {String(rep.day_start).slice(0, 5)}{rep.start_address ? ` from ${rep.start_address}` : ""}</p></div>
        <div className="row" style={{ gap: 6 }}>
          {(reps || []).length > 1 && isLead && (
            <form className="row" style={{ gap: 6 }}><input type="hidden" name="date" value={day} />
              <select name="rep" defaultValue={rep.id} aria-label="Salesperson" style={{ width: "auto" }}>{reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <button className="sm ghost">Show</button></form>
          )}
          <Link className="btn sm ghost" href={`/app/sales/day?${q({ date: addDays(day, -1) })}`}>←</Link>
          <Link className="btn sm ghost" href={`/app/sales/day?${q({ date: addDays(day, 1) })}`}>→</Link>
        </div>
      </div>
      {!plan.length && <div className="panel small muted">Nothing booked for this day.</div>}
      <ol className="stack-sm" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {plan.map((p, i) => (
          <li key={p.id} className="stack-sm">
            {p.mode === "field" && (
              <div className="row small" style={{ gap: 8, color: "var(--ink-2)", paddingLeft: 6 }}>
                <span aria-hidden>🚗</span><span>Leave <strong>{p.leave}</strong> · {p.drive} min drive from {i === 0 ? "your start point" : p.from}</span>
                <a className="btn sm ghost" href={directionsUrl(p.from, p.address)} target="_blank" rel="noreferrer">Directions</a>
              </div>
            )}
            <div className="panel" style={{ padding: 14, borderLeft: `4px solid ${p.mode === "field" ? "var(--violet)" : "var(--primary)"}` }}>
              <div className="row between">
                <div><strong className="num">{p.start}–{p.end}</strong> · {p.title}{p.leads ? <> · <Link href={`/app/leads/${p.leads.id}`}>{p.leads.name}</Link></> : null}</div>
                <span className={`chip ${p.status === "done" ? "ok" : p.status === "no_show" ? "bad" : "info"}`}>{p.status === "booked" ? (p.mode === "field" ? "Visit" : "Online") : p.status === "done" ? "Done" : "No-show"}</span>
              </div>
              <div className="tiny faint" style={{ marginTop: 4 }}>{[p.leads?.contact_person, p.leads?.phone, p.mode === "field" ? p.address : null, p.notes].filter(Boolean).join(" · ")}</div>
              {p.status === "booked" && role !== "viewer" && (
                <div className="row" style={{ gap: 6, marginTop: 8 }}>
                  {telLink(p.leads?.phone) && <a className="btn sm ghost" href={telLink(p.leads.phone)}>Call</a>}
                  {[["done", "Mark done"], ["no_show", "No-show"]].map(([st, l]) => (
                    <form key={st} action={setMeetingStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={st} /><SubmitButton className="sm ghost">{l}</SubmitButton></form>
                  ))}
                </div>
              )}
            </div>
            {p.idle >= 60 && i > 0 && <div className="tiny faint" style={{ paddingLeft: 6 }}>{Math.round(p.idle / 60 * 10) / 10} h free before this</div>}
          </li>
        ))}
      </ol>
    </>
  );
}
