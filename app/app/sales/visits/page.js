import Link from "next/link";
import { getContext } from "@/lib/session";
import { local, addDays, at } from "@/lib/scheduling";
import { pairVisits, dayDistanceKm, mapLink, ROUGH_M } from "@/lib/visits";

export const metadata = { title: "Field visits" };

// Proof of field visits: each salesperson's GPS check-ins for the day, time at each client, distance covered.
export default async function Visits({ searchParams }) {
  const sp = await searchParams;
  const today = local(new Date()).day;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(sp?.date || "") ? sp.date : today;
  const { supabase, company, user, role } = await getContext();
  const isLead = ["admin", "manager"].includes(role);
  // RLS shows others' check-ins only to admins and managers
  const [{ data: checks }, { data: reps }] = await Promise.all([
    supabase.from("visit_checkins").select("*, leads(id, name), meetings(title, address, starts_at)").eq("company_id", company.id)
      .gte("at", at(day, 0).toISOString()).lt("at", at(day, 1440).toISOString()).order("at"),
    supabase.from("sales_reps").select("id, name, user_id").eq("company_id", company.id),
  ]);
  const byRep = new Map();
  for (const c of checks || []) { const k = c.rep_id || c.user_id; if (!byRep.has(k)) byRep.set(k, []); byRep.get(k).push(c); }
  const name = (k) => (reps || []).find((r) => r.id === k || r.user_id === k)?.name || "Salesperson";
  const hhmm = (t) => new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  const label = new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" });

  return (
    <>
      <div className="page-head">
        <div><h1>Field visits</h1><p>{label} · proof of visit from each salesperson&apos;s phone GPS when they check in and out at a client (from My day).{isLead ? "" : " You see your own visits."}</p></div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn sm ghost" href={`/app/sales/visits?date=${addDays(day, -1)}`}>←</Link>
          <Link className="btn sm ghost" href={`/app/sales/visits?date=${addDays(day, 1)}`}>→</Link>
        </div>
      </div>
      {!byRep.size && <div className="panel small muted">No check-ins on this day. Field salespeople press “📍 Check in” on a visit in My day when they reach the client, and “Check out” when they leave.</div>}
      {[...byRep.entries()].map(([k, rows]) => {
        const visits = pairVisits(rows);
        const km = dayDistanceKm(rows);
        const mins = visits.reduce((s, v) => s + (v.minutes || 0), 0);
        return (
          <div key={k} className="panel flush table-wrap">
            <div className="row between" style={{ padding: "14px 16px 6px" }}>
              <h3 style={{ margin: 0 }}>{name(k)}{rows[0]?.user_id === user.id ? " (you)" : ""}</h3>
              <span className="small faint">{visits.length} visit{visits.length === 1 ? "" : "s"} · {Math.floor(mins / 60) ? `${Math.floor(mins / 60)} h ` : ""}{mins % 60} min with clients · {km} km between stops (straight line)</span>
            </div>
            <table>
              <thead><tr><th>Client</th><th>In</th><th>Out</th><th>Time there</th><th>From last stop</th></tr></thead>
              <tbody>
                {visits.map((v, i) => {
                  const m = rows.find((r) => r.meeting_id === v.meeting_id);
                  return (
                    <tr key={i}>
                      <td className="small">{m?.leads ? <Link href={`/app/leads/${m.leads.id}`}>{m.leads.name}</Link> : m?.meetings?.title || "Visit"}{m?.meetings?.address && <div className="tiny faint">{m.meetings.address}</div>}{(v.out?.note || v.in?.note) && <div className="tiny">{v.out?.note || v.in?.note}</div>}</td>
                      <td className="small">{hhmm(v.in.at)} · <a href={mapLink(v.in)} target="_blank" rel="noreferrer">map</a>{v.in.accuracy_m > ROUGH_M && <div className="tiny faint">rough ±{v.in.accuracy_m} m</div>}</td>
                      <td className="small">{v.out ? <>{hhmm(v.out.at)} · <a href={mapLink(v.out)} target="_blank" rel="noreferrer">map</a></> : <span className="chip warn">Still there / not checked out</span>}</td>
                      <td className="small">{v.minutes ? `${v.minutes} min` : "—"}</td>
                      <td className="small">{v.from_prev_m === null ? "First stop" : `${Math.round(v.from_prev_m / 100) / 10} km`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="tiny faint" style={{ margin: 0 }}>The location is taken only when the person presses Check in / Check out — Dhandha does not track phones in between. Distances are straight lines between stops; roads are longer.</p>
    </>
  );
}
