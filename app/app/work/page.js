import Link from "next/link";
import { getContext } from "@/lib/session";
import { jobList, workSummary } from "@/lib/workProgress";
import UpdateForm from "./UpdateForm";
import TrackDeal from "./TrackDeal";
import { finishDeal } from "./actions";

export const metadata = { title: "Work in hand" };
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const when = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Work in hand (12 Nov, map item 7): every won job — tenders won and deals tracked as jobs — with progress against the
// time gone, site updates with photos, crew on site and problems that alert the managers.
export default async function Work() {
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: matches }, { data: deals }, { data: wonDeals }] = await Promise.all([
    supabase.from("tender_matches").select("id, contract_value, quoted_price, work_start, work_end, loa_no, tenders(title, authority)")
      .eq("company_id", company.id).eq("status", "won").is("completed_on", null).limit(100),
    supabase.from("deals").select("id, title, value_inr, work_start, work_end, leads(name)")
      .eq("company_id", company.id).eq("track_work", true).is("completed_on", null).limit(100),
    supabase.from("deals").select("id, title").eq("company_id", company.id).eq("stage", "won").eq("track_work", false).order("closed_at", { ascending: false }).limit(50),
  ]);
  const mIds = (matches || []).map((m) => m.id), dIds = (deals || []).map((d) => d.id);
  const [{ data: um }, { data: ud }] = await Promise.all([
    mIds.length ? supabase.from("work_updates").select("*").in("match_id", mIds).is("archived_at", null).order("created_at", { ascending: false }).limit(300) : { data: [] },
    dIds.length ? supabase.from("work_updates").select("*").in("deal_id", dIds).is("archived_at", null).order("created_at", { ascending: false }).limit(300) : { data: [] },
  ]);
  const rows = jobList({ matches: matches || [], deals: deals || [], updates: [...(um || []), ...(ud || [])] });
  const s = workSummary(rows);
  // photos of the latest three updates per job, as short-lived signed links
  const paths = rows.flatMap((r) => r.updates.slice(0, 3).flatMap((u) => u.photos || []));
  const { data: signed } = paths.length ? await supabase.storage.from("work-photos").createSignedUrls(paths, 3600) : { data: [] };
  const url = Object.fromEntries((signed || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
  const canManage = ["admin", "manager"].includes(role);

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Work in hand</h1><p>Every job you have won — progress against the time gone, site photos, who was on site and any problem. Post an update from the site on your phone; a problem alerts your managers.</p></div></div>
      <div className="grid-3">
        <div className="panel"><div className="kpi-label">Jobs running</div><div className="kpi">{s.jobs}</div><div className="small faint">{inr(s.value)} in hand</div></div>
        <div className="panel"><div className="kpi-label">Behind or with a problem</div><div className="kpi" style={{ color: s.behind + s.issues ? "var(--blood)" : undefined }}>{s.behind + s.issues}</div><div className="small faint">{s.issues} problem{s.issues === 1 ? "" : "s"} open</div></div>
        <div className="panel"><div className="kpi-label">People on site (latest)</div><div className="kpi">{s.crew}</div><div className="small faint">{s.quiet} job{s.quiet === 1 ? "" : "s"} with no update for 7 days</div></div>
      </div>
      {canManage && <div className="panel"><TrackDeal deals={wonDeals || []} /></div>}
      {!rows.length && <div className="panel empty-state"><p className="muted" style={{ margin: 0 }}>No jobs yet. A tender you win shows here (add the LoA and work dates on its page), and you can track any won deal as a job above.</p></div>}
      {rows.map((r) => (
        <div key={r.key} className="panel stack-sm">
          <div className="row" style={{ justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <Link href={r.href} style={{ fontWeight: 600 }}>{r.title}</Link>
              <div className="small muted">{r.kind === "tender" ? "Tender" : "Deal"}{r.client ? ` · ${r.client}` : ""}{r.value ? ` · ${inr(r.value)}` : ""}{r.ref ? ` · LoA ${r.ref}` : ""}{r.start ? ` · ${r.start} → ${r.end || "?"}` : " · add work dates"}</div>
            </div>
            <span className={`chip ${r.status.tone}`}>{r.status.label}</span>
          </div>
          <div className="work-bar" title={r.status.expected != null ? `${r.progress ?? 0}% done; ${r.status.expected}% of the time gone` : undefined}>
            <span className="done" style={{ width: `${r.progress ?? 0}%` }} />
            {r.status.expected != null && <span className="due" style={{ left: `${r.status.expected}%` }} />}
          </div>
          {r.issue && <div className="notice bad small" style={{ margin: 0 }}><strong>Problem on site:</strong> {r.issue.note || "(no note)"} — {when(r.issue.created_at)}</div>}
          {r.updates.slice(0, 3).map((u) => (
            <div key={u.id} className="small" style={{ borderLeft: "2px solid var(--line)", paddingLeft: 10 }}>
              <span className="faint">{when(u.created_at)}</span>
              {u.progress != null && <> · <strong>{u.progress}%</strong></>}
              {u.crew != null && <> · {u.crew} on site{u.crew_names ? ` (${u.crew_names})` : ""}</>}
              {u.lat && <> · <a href={`https://maps.google.com/?q=${u.lat},${u.lng}`} target="_blank" rel="noreferrer">map</a></>}
              {u.note && <div>{u.note}</div>}
              {(u.photos || []).length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {u.photos.map((p) => url[p] && <a key={p} href={url[p]} target="_blank" rel="noreferrer"><img src={url[p]} alt="Site photo" className="work-photo" /></a>)}
                </div>
              )}
            </div>
          ))}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <UpdateForm job={{ kind: r.kind, id: r.id }} tenantId={tenant.id} companyId={company.id} last={r.progress} />
            {canManage && r.kind === "deal" && <form action={finishDeal}><input type="hidden" name="deal_id" value={r.id} /><button className="btn sm ghost">Mark completed</button></form>}
            {r.kind === "tender" && r.progress >= 100 && <Link href={r.href} className="btn sm ghost">Mark completed → Experience</Link>}
          </div>
        </div>
      ))}
    </div>
  );
}
