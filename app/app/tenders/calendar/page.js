import Link from "next/link";
import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import { newCalendar, revokeCalendar } from "./actions";

export const metadata = { title: "Bid calendar" };

export default async function BidCalendar() {
  const { supabase, company, role } = await getContext();
  const h = await headers();
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const can = ["admin", "manager", "bid_preparer"].includes(role);
  const { data: feeds } = await supabase.from("calendar_feeds").select("*").eq("company_id", company.id).is("revoked_at", null).order("created_at");
  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>Bid calendar</h1><p>One calendar link with every date that matters for the bids you are working on — closing times, pre-bid meetings, bid openings, bank guarantee expiry and bid-plan tasks — in Google Calendar, Outlook or your phone, updated by itself.</p></div></div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Your calendar links</h3>
          {!(feeds || []).length && <p className="small muted" style={{ margin: 0 }}>No link yet.</p>}
          {(feeds || []).map((f) => {
            const url = `${origin}/api/cal/${f.token}.ics`;
            return (
              <div key={f.token} className="stack-sm" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}>
                <input readOnly value={url} style={{ fontSize: 12 }} />
                <div className="row between tiny faint"><span>Made {fmtDate(f.created_at)} · {f.uses ? `read ${f.uses} times, last ${fmtDate(f.last_used_at)}` : "not used yet"}</span>
                  <span className="row" style={{ gap: 4 }}>
                    <a className="btn sm ghost" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https:/, "webcal:"))}`} target="_blank" rel="noreferrer">Add to Google Calendar</a>
                    <a className="btn sm ghost" href={url.replace(/^https:/, "webcal:")}>Phone / Outlook</a>
                    {can && <form action={revokeCalendar}><input type="hidden" name="token" value={f.token} /><SubmitButton className="sm ghost" confirm="Switch this link off? Calendars using it stop updating.">Switch off</SubmitButton></form>}
                  </span></div>
              </div>
            );
          })}
          {can && <form action={newCalendar}><SubmitButton>{(feeds || []).length ? "Make another link" : "Make my calendar link"}</SubmitButton></form>}
        </div>
        <div className="panel">
          <h3>What it shows</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
            <li>Closing time of every tender you shortlisted, are preparing or submitted (with a reminder a day before)</li>
            <li>Pre-bid meetings and bid openings</li>
            <li>Bank guarantee expiry dates from EMD &amp; BGs</li>
            <li>Bid-plan tasks still open</li>
          </ul>
          <p className="tiny faint" style={{ marginBottom: 0 }}>Anyone with the link can read these dates and tender names, so share it only inside your team. Google refreshes subscribed calendars every few hours.</p>
        </div>
      </div>
    </div>
  );
}
