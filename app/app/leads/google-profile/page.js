import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";
import { profileHealth, reviewUrl } from "@/lib/gbp";
import { ScoreRing } from "@/components/Charts";
import Icon from "@/components/Icon";
import FormState from "../../FormState";
import ProfileTools from "./ProfileTools";
import { saveReviewSettings } from "../googleActions";

const STATUS = { waiting: ["mute", "Waiting"], emailed: ["info", "Emailed"], task: ["warn", "Task for WhatsApp"], skipped: ["mute", "Skipped"], clicked: ["ok", "Opened the review page"] };

// Google Business Profile: how strong the listing is, what to fix, and automatic review requests to won customers.
export default async function GoogleProfile() {
  const { supabase, company, isAdmin } = await getContext();
  const [{ data: s }, { data: snaps }, { data: reqs }] = await Promise.all([
    supabase.from("review_settings").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("gbp_snapshots").select("taken_on, rating, reviews").eq("company_id", company.id).order("taken_on", { ascending: false }).limit(60),
    supabase.from("review_requests").select("id, status, due_at, done_at, clicked_at, leads(id, name)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const h = s?.details ? profileHealth(s.details) : null;
  const first = (snaps || []).at(-1), gained = first && s?.reviews != null ? s.reviews - (first.reviews || 0) : 0;
  const asked = (reqs || []).filter((r) => r.status !== "waiting" && r.status !== "skipped").length, clicked = (reqs || []).filter((r) => r.status === "clicked").length;
  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Google Business Profile</h1><p>People nearby who search for what you do see this listing first — its reviews and completeness decide whether they call you. Free.</p></div></div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          {s?.place_id ? (
            <div className="row" style={{ gap: 14, flexWrap: "nowrap", alignItems: "flex-start" }}>
              {h && <ScoreRing score={h.score} size={72} />}
              <div>
                <h3 style={{ margin: 0 }}>{s.place_name}</h3>
                <div className="small muted">{s.place_address}</div>
                <div className="small" style={{ marginTop: 4 }}>{s.rating ? `★ ${Number(s.rating).toFixed(1)}` : "No rating"} · {s.reviews || 0} reviews{gained > 0 ? ` · +${gained} since ${fmtDate(first.taken_on)}` : ""}</div>
                <div className="row tiny" style={{ gap: 10, marginTop: 6 }}>{s.maps_url && <a href={s.maps_url} target="_blank" rel="noreferrer">Open on Google Maps</a>}<a href={reviewUrl(s.place_id)} target="_blank" rel="noreferrer">Your review link</a><span className="faint">checked {fmtDate(s.checked_at)}</span></div>
              </div>
            </div>
          ) : <p className="small muted" style={{ margin: 0 }}>Link your Google listing to see its strength and start collecting reviews.</p>}
          {isAdmin && <ProfileTools linked={!!s?.place_id} />}
        </div>
        {h && (
          <div className="panel stack-sm">
            <h3 style={{ margin: 0 }}>Listing check</h3>
            <ul className="reasons" style={{ margin: 0 }}>
              {h.items.map((i) => <li key={i.key}><Icon name={i.ok ? "check" : "cross"} size={14} style={{ color: i.ok ? "var(--leaf)" : "var(--blood)" }} /><span><strong>{i.label}</strong>{!i.ok && i.fix ? <span className="small muted"> — {i.fix}</span> : null}</span></li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Automatic review requests</h3>
          <p className="small muted" style={{ margin: 0 }}>When a deal is marked <strong>Won</strong>, Dhandha waits the days you set, then emails the customer your review link (when email sending is on), or gives the salesperson a task with a ready WhatsApp message. Every won customer is asked — Google does not allow asking only the happy ones, or offering anything for a review.</p>
          {isAdmin ? (
            <FormState action={saveReviewSettings}>
              <label className="row" style={{ gap: 10, margin: 0, fontWeight: 500 }}><input type="checkbox" name="auto_ask" defaultChecked={s?.auto_ask ?? true} style={{ width: "auto" }} /> Ask every won customer for a Google review</label>
              <div className="form-grid">
                <div><label htmlFor="rv-d">Days after winning</label><input id="rv-d" name="delay_days" type="number" min={0} max={30} defaultValue={s?.delay_days ?? 1} /></div>
                <div><label htmlFor="rv-s">Email subject</label><input id="rv-s" name="subject" defaultValue={s?.subject || "A quick favour, {name}?"} /></div>
              </div>
              <div><label htmlFor="rv-m">Message ({"{name}"}, {"{company}"}, {"{link}"})</label><textarea id="rv-m" name="message" rows={4} defaultValue={s?.message || "Thank you for choosing {company}. If you were happy with our work, a short Google review would help other businesses find us — it takes a minute: {link}"} /></div>
            </FormState>
          ) : <p className="small">{s?.auto_ask ? "On." : "Off."}</p>}
          {!s?.place_id && <p className="tiny faint" style={{ margin: 0 }}>Requests start once your listing is linked above.</p>}
        </div>
        <div className="panel stack-sm">
          <div className="row between"><h3 style={{ margin: 0 }}>Requests sent</h3><span className="tiny faint">{asked} asked · {clicked} opened the review page</span></div>
          {!reqs?.length && <p className="small muted" style={{ margin: 0 }}>None yet — they start with your next won deal.</p>}
          {(reqs || []).map((r) => { const [cls, txt] = STATUS[r.status]; return (
            <div key={r.id} className="row between small" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 6 }}>
              <span>{r.leads ? <Link href={`/app/leads/${r.leads.id}`}>{r.leads.name}</Link> : "—"} <span className="tiny faint">{fmtDate(r.done_at || r.due_at)}</span></span><span className={`chip ${cls}`}>{txt}</span>
            </div>); })}
        </div>
      </div>

      <div className="panel stack-sm">
        <h3 style={{ margin: 0 }}>More ways to rank higher nearby</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
          <li><strong>Reply to every review</strong> within two days — good and bad. Replies are a ranking signal and win over readers.</li>
          <li><strong>Post an update every week</strong> (offer, completed project, tip) from the Google Business Profile app.</li>
          <li><strong>List every service</strong> with a line of description, and pick the most precise primary category.</li>
          <li><strong>Keep name, address and phone identical</strong> on your website, IndiaMART, JustDial and social pages.</li>
          <li><strong>Add photos monthly</strong> — team, office, work done; geotagged phone photos are fine.</li>
          <li>Ask and answer your own common questions in the <strong>Q&amp;A</strong> section.</li>
        </ul>
      </div>
    </div>
  );
}
