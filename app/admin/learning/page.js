import Link from "next/link";
import { getAdminContext } from "@/lib/admin";
import { sectorLabel } from "@/lib/formatHarvest";

export const dynamic = "force-dynamic";

const n = (v) => Number(v || 0).toLocaleString("en-IN");
const plus = (v, when) => (Number(v) > 0 ? `+${n(v)} ${when}` : `none new ${when}`);

// Everything Dhandha has learned so far, in one place: what each store holds, how fast it grows, where it lives (table)
// and which code uses it. Learning here is data gathered in the database and used by plain formulas; the AI models
// themselves (Gemini, Claude) are not trained by Dhandha.
export default async function Learning() {
  const { supabase } = await getAdminContext();
  const { data: s, error } = await supabase.rpc("learning_stats");
  if (error || !s) return <div className="panel small">Could not load: {error?.message || "no data"}</div>;
  const f = s.formats || {}, d = s.decisions || {}, a = s.ai || {};
  const sectors = Object.entries(f.sectors || {}).sort((x, y) => y[1] - x[1]);
  const cards = [
    { title: "Format catalogue", big: n(f.total), sub: `${plus(f.day, "today")} · ${plus(f.week, "this week")}`, lines: [`${n(f.repeats)} repeats recognised in other tenders`, `${n(f.approved)} approved · ${n(f.hidden)} hidden · used ${n(f.used)} times in bids`], where: "format_catalog · lib/formatHarvest.js", href: "/admin/formats" },
    { title: "Tenders read in full (study)", big: n(s.texts?.total), sub: `${plus(s.texts?.day, "today")} · ${s.texts?.mb || 0} MB of text`, lines: [`${n(s.texts?.studied)} studied so far`, `Harvest: ${n(s.harvest?.fetched_today)} fetched today · ${n(s.harvest?.waiting)} waiting · ${n(s.harvest?.failed_today)} failed today`], where: "tender_texts · TENDER_STUDY.md" },
    { title: "Tender readings", big: n(s.reads?.total), sub: `${plus(s.reads?.day, "today")} · ${plus(s.reads?.week, "this week")}`, lines: [`${n(s.reads?.free)} by the free reader · ${n(s.reads?.ai)} by AI`], where: "tender_reads · lib/tenderRules.js, lib/tenderAi.js" },
    { title: "What firms take up or drop", big: n(d.taken), sub: `taken up · ${n(d.dropped)} dropped`, lines: [`AI check: ${n(d.ai_checked)} checked (${plus(d.ai_checked_week, "this week")}) — ${n(d.ai_yes)} fit, ${n(d.ai_no)} not`, `Results recorded: ${n(d.results)} (${n(d.won)} won, ${n(d.lost)} lost)`], where: "tender_matches · lib/tenderCheck.js, lib/matchLearning.js, lib/bidChance.js" },
    { title: "Chance to close a lead", big: n(s.winchance?.rows), sub: "patterns learned from won / lost deals", lines: [`${n(s.winchance?.companies)} firms · ${n(s.winchance?.global)} shared patterns`, `Most deals behind one pattern: ${n(s.winchance?.deals)}${s.winchance?.updated ? ` · rebuilt ${new Date(s.winchance.updated).toLocaleDateString("en-IN")}` : ""}`], where: "win_stats · lib/winChance.js (nightly)" },
    { title: "Tender results & rivals", big: n(s.awards?.total), sub: `award results · ${plus(s.awards?.week, "this week")}`, lines: [`${n(s.rivals?.followed)} rivals followed`, "Feeds price-to-win and tender-winner leads"], where: "tender_awards, rivals · lib/pastResults.js" },
    { title: "Answers given once, reused everywhere", big: n(s.masters?.answers), sub: `${plus(s.masters?.week, "this week")}`, lines: [`${n(s.masters?.from_documents)} read from Vault documents`, "Fills the same blank in every later format"], where: "company_facts (master.*) · lib/masters.js" },
    { title: "AI calling lessons", big: n(s.voice?.lessons), sub: `${n(s.voice?.shared)} shared with everyone`, lines: [`${n(s.voice?.calls)} test calls (${plus(s.voice?.calls_week, "this week")})`], where: "voice_lessons, voice_sessions · lib/callLearning.js", href: "/admin/voice" },
    { title: "Portal sessions", big: n(s.sessions?.logged), sub: `sessions logged across ${n(s.sessions?.portals)} portals`, lines: ["How long each portal keeps a captcha session", `${plus(s.sessions?.week, "this week")}`], where: "portal_session_log · crawler/src/docs.js", href: "/admin/captcha" },
    { title: "Industries & services added by firms", big: n(s.taxonomy?.added), sub: `${n(s.taxonomy?.approved)} approved · ${n(s.taxonomy?.pending)} waiting`, lines: ["Grows the catalogue every firm searches"], where: "taxonomy_custom · lib/taxonomy.js", href: "/admin/taxonomy" },
    { title: "AI spend", big: `$${a.usd_week ?? 0}`, sub: `this week · $${a.usd_total ?? 0} in all`, lines: [`${n(a.calls_week)} AI calls this week · ${a.free_share_week ?? 0}% on free tiers`, `${n(a.failed_week)} failed and fell through to the next tier`], where: "ai_usage · lib/ai.js", href: "/admin/ai" },
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>What Dhandha has learned</h1>
        <p>Dhandha does not train its own AI model. It learns by collecting data in the database — formats, readings, decisions, results — and simple formulas in the code use it. Nothing is lost when the code changes; it grows with every tender and every customer.</p></div></div>
      <div className="grid-3">
        {cards.map((c) => (
          <div key={c.title} className="panel ledger stack-sm">
            <div className="kpi-label">{c.title}</div>
            <div className="kpi">{c.big}</div>
            <div className="faint small">{c.sub}</div>
            {c.lines.map((l) => <div key={l} className="small">{l}</div>)}
            <div className="tiny faint" style={{ marginTop: "auto" }}>{c.where}{c.href && <> · <Link href={c.href}>Open</Link></>}</div>
          </div>
        ))}
      </div>
      {sectors.length > 0 && (
        <div className="panel stack-sm">
          <strong>Formats learned by industry</strong>
          <div className="row" style={{ gap: 6 }}>{sectors.map(([k, v]) => <span key={k} className="chip mute">{sectorLabel(k)} · {n(v)}</span>)}</div>
          <div className="tiny faint">Industries with few formats fill in as the harvest reads more tenders.</div>
        </div>
      )}
    </div>
  );
}
