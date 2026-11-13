import Link from "next/link";
import { getContext } from "@/lib/session";
import { monthGrid, CHANNELS, THEMES } from "@/lib/contentPlan";
import VoiceForm from "./VoiceForm";
import PlanButton from "./PlanButton";
import PostEditor from "./PostEditor";

export const metadata = { title: "Posts calendar" };
const STATUS = { draft: ["Draft", "mute"], ready: ["Ready", "info"], posted: ["Posted", "ok"], skipped: ["Skipped", "mute"] };

// Posts calendar & brand voice (13 Nov, map item 8): a month of posts in your own voice, written free from templates
// or by AI, copied to Google / LinkedIn / Facebook / Instagram / WhatsApp and marked posted.
export default async function Posts({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const ist = new Date(Date.now() + 330 * 60000);
  const [y, m] = /^\d{4}-\d{2}$/.test(sp?.m || "") ? sp.m.split("-").map(Number) : [ist.getUTCFullYear(), ist.getUTCMonth() + 1];
  const mm = `${y}-${String(m).padStart(2, "0")}`;
  const [{ data: voice }, { data: posts }] = await Promise.all([
    supabase.from("brand_voice").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("content_posts").select("*").eq("company_id", company.id).is("archived_at", null).gte("post_on", `${mm}-01`).lte("post_on", `${mm}-31`).order("post_on"),
  ]);
  const canEdit = ["admin", "manager"].includes(role);
  const weeks = monthGrid(y, m, posts || []);
  const open = (posts || []).find((p) => p.id === sp?.post) || null;
  const newDay = /^\d{4}-\d{2}-\d{2}$/.test(sp?.day || "") ? sp.day : null;
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`, next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  const counts = (posts || []).reduce((a, p) => ((a[p.status] = (a[p.status] || 0) + 1), a), {});
  const monthName = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Posts calendar</h1><p>A month of posts in your own voice — planned for you, written free from templates or with AI, then copied to Google, LinkedIn, Facebook, Instagram or WhatsApp. Nothing is posted without you.</p></div></div>
      <details className="panel" open={!voice}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Brand voice {voice ? <span className="small faint">· {voice.tone}, {voice.per_week} a week</span> : <span className="chip warn">set it first</span>}</summary>
        <div style={{ marginTop: 12 }}><VoiceForm v={voice || {}} canEdit={canEdit} /></div>
      </details>
      <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <Link href={`/app/posts?m=${prev}`} className="btn sm ghost" aria-label="Previous month">←</Link>
          <strong>{monthName}</strong>
          <Link href={`/app/posts?m=${next}`} className="btn sm ghost" aria-label="Next month">→</Link>
          <span className="small faint">{counts.posted || 0} posted · {counts.draft || 0} drafts{counts.skipped ? ` · ${counts.skipped} skipped` : ""}</span>
        </div>
        {canEdit && <PlanButton month={mm} />}
      </div>
      {(open || newDay) && (
        <div className="panel stack-sm" id="editor">
          <div className="row" style={{ justifyContent: "space-between" }}><strong>{open ? "Edit post" : `New post for ${newDay}`}</strong><Link href={`/app/posts?m=${mm}`} className="small">Close</Link></div>
          <PostEditor key={open?.id || newDay} p={open} day={newDay} canEdit={canEdit} />
        </div>
      )}
      <div className="cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cal-head">{d}</div>)}
        {weeks.flat().map((c, i) => c ? (
          <div key={c.day} className="cal-day">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="small" style={{ fontWeight: 600 }}>{c.d}</span>
              {canEdit && <Link href={`/app/posts?m=${mm}&day=${c.day}#editor`} className="faint small" aria-label={`Add a post on ${c.day}`}>＋</Link>}
            </div>
            {c.occasion && <div className="faint" style={{ fontSize: 11 }}>{c.occasion}</div>}
            {c.posts.map((p) => (
              <Link key={p.id} href={`/app/posts?m=${mm}&post=${p.id}#editor`} className={`cal-post s-${p.status}`} title={p.body}>
                <span className={`chip plain ${STATUS[p.status][1]}`} style={{ fontSize: 10.5 }}>{CHANNELS[p.channel]?.label || p.channel}</span>
                <span className="cal-post-t">{p.title || THEMES[p.theme] || "Post"}</span>
              </Link>
            ))}
          </div>
        ) : <div key={`e${i}`} className="cal-day empty" />)}
      </div>
    </div>
  );
}
