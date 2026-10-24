import { anonClient } from "@/lib/supabase/anon";
import Picker from "./Picker";

export const metadata = { title: "Book a meeting", robots: { index: false } };

// The client's booking page (no login): the business, the meeting, and free times grouped by day and part of day.
export default async function Book({ params }) {
  const { token } = await params;
  const ok = /^[0-9a-f-]{36}$/i.test(token);
  const { data } = ok ? await anonClient().rpc("booking_view", { p_token: token }) : { data: { error: "This booking link is not valid." } };
  const v = data || { error: "This booking link is not valid." };
  const when = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "start center", padding: "40px 16px" }}>
      <div className="panel stack" style={{ maxWidth: 620, width: "100%" }}>
        {v.error ? <><h1 style={{ fontSize: 22, margin: 0 }}>Link not valid</h1><p className="muted" style={{ margin: 0 }}>{v.error}</p></> : (
          <>
            <div>
              <div className="tiny faint">{v.business}</div>
              <h1 style={{ fontSize: 24, margin: "2px 0 4px" }}>{v.meeting}</h1>
              <div className="row small muted" style={{ gap: 10 }}>
                <span className="chip info plain">{v.mode === "field" ? "We visit you" : "Online"}</span><span>{v.duration} minutes</span>
                {v.mode === "field" && v.address && <span>at {v.address}</span>}
              </div>
            </div>
            {v.booked ? (
              <div className="notice info" style={{ display: "block" }}>
                <strong>{v.booked.status === "cancelled" ? "This meeting was cancelled." : "Your meeting is booked."}</strong>
                <div className="small">{when(v.booked.start)}</div>
              </div>
            ) : v.expired ? <p className="muted" style={{ margin: 0 }}>This link has expired. Please ask {v.business} for a new one.</p>
              : <Picker token={token} slots={v.slots} contact={v.contact} mode={v.mode} />}
          </>
        )}
        <p className="tiny faint" style={{ margin: 0 }}>Scheduled with Dhandha.</p>
      </div>
    </main>
  );
}
