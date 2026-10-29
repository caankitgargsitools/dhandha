import Link from "next/link";
import { getContext, fmtDate } from "@/lib/session";
import { lineStats, callFunnel } from "@/lib/callLearning";
import { callInsights, objectionStats, lessonSuggestions, MOOD } from "@/lib/callInsights";
import SuggestLesson from "./SuggestLesson";
import { CallFunnel, LineTable } from "@/components/CallLines";
import SubmitButton from "@/components/SubmitButton";
import Transcript from "./Transcript";
import NewLesson from "./NewLesson";
import { setLesson } from "./actions";

export const metadata = { title: "Call learning" };

const OUT = { interested: "Interested", call_back: "Call back", not_interested: "Not interested", connected: "Talked" };
const MOOD_CHIP = { positive: "ok", neutral: "mute", negative: "bad" };
const SCOPE = { playbook: "One playbook", company: "Every call", global: "All Dhandha customers" };

export default async function Learning({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) return <div className="panel">Call learning is for admins and managers.</div>;
  const [{ data: calls, error }, { data: lessons }, { data: books }] = await Promise.all([
    supabase.rpc("voice_calls_for_learning", { p_company: company.id, p_days: 90 }),
    supabase.from("voice_lessons").select("id, scope, kind, situation, bad, better, status, starter, sequence_id, company_id, tenant_id, created_at").order("created_at", { ascending: false }),
    supabase.from("sequences").select("id, name").eq("company_id", company.id).order("created_at"),
  ]);
  const list = calls || [];
  const stats = lineStats(list);
  const funnel = callFunnel(list);
  const call = sp?.call ? list.find((c) => c.token === sp.call) : null;
  const ins = call ? callInsights(call) : null;
  const objStats = objectionStats(list);
  const suggestions = lessonSuggestions(objStats, (lessons || []).filter((l) => l.company_id === company.id));
  const focus = sp?.turn != null ? Number(sp.turn) : null;
  const ours = (lessons || []).filter((l) => l.company_id === company.id);
  const shared = (lessons || []).filter((l) => l.tenant_id == null && l.status === "active");
  const bookName = Object.fromEntries((books || []).map((b) => [b.id, b.name]));
  const link = (e) => `/app/leads/playbook/learning?call=${e.token}&turn=${e.turn}#line-${e.turn}`;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <Link href="/app/leads/playbook" className="small">← Lead Playbook</Link>
          <h1>Call learning</h1>
          <p>What Dhandha AI said on your calls and what clients did next: lines that keep people talking, lines after which they cut in or hang up. Open a call, press "Should have said…" on any line, try the better answer, and save it as a lesson — Dhandha AI follows it from the next call.</p>
        </div>
      </div>
      {error && <p className="error">{error.message}</p>}

      {!list.length && <div className="notice">No calls yet. Run a test call from a playbook's AI-call step (▶ Test this call) — it shows up here when it ends.</div>}
      <CallFunnel funnel={funnel} />

      {call && (
        <div className="panel" id="call">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Call {call.lead_name ? `with ${call.lead_name}` : "(test)"} · {fmtDate(call.ended_at)}</h3>
            <Link className="small" href="/app/leads/playbook/learning">Close</Link>
          </div>
          <p className="small muted">{OUT[call.outcome] || "No result"} · {call.ended_by === "client" ? "the client hung up" : call.ended_by === "ai" ? "Dhandha AI ended it" : "ended"}{call.sequence_id ? ` · ${bookName[call.sequence_id] || "playbook"}` : ""}</p>
          <div className="row small" style={{ gap: 6 }}>
            <span className={`chip ${MOOD_CHIP[ins.mood]}`}>{MOOD[ins.mood]}</span>
            {ins.objections.map((o) => <a key={o.kind} className="chip warn" href={`#line-${o.turn}`} title={o.text}>{o.label}</a>)}
          </div>
          <p className="small" style={{ margin: "6px 0" }}>{call.summary || ins.summary} <strong>Next:</strong> {ins.next}.</p>
          <Transcript call={call} playbooks={books || []} canTeach focus={Number.isInteger(focus) ? focus : null} />
        </div>
      )}

      {list.length > 0 && (
        <>
          {objStats.length > 0 && (
            <div className="panel flush table-wrap">
              <h3 style={{ padding: "14px 16px 0" }}>Objections clients raise</h3>
              <p className="tiny faint" style={{ padding: "0 16px" }}>Read free from what clients said. &ldquo;Still went well&rdquo; = the call ended interested or with a call-back. Open an example and teach Dhandha AI a better answer.</p>
              <table>
                <thead><tr><th>Objection</th><th>Calls</th><th>Still went well</th><th>Example</th></tr></thead>
                <tbody>
                  {objStats.map((o) => (
                    <tr key={o.kind}>
                      <td className="small"><strong>{o.label}</strong></td>
                      <td>{o.calls}</td>
                      <td className="small">{Math.round((o.saved / o.calls) * 100)}%</td>
                      <td className="small"><Link href={`/app/leads/playbook/learning?call=${o.example.token}&turn=${o.example.turn}#line-${o.example.turn}`}>&ldquo;{o.example.text.slice(0, 80)}&rdquo;</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="panel stack-sm">
              <h3 style={{ margin: 0 }}>Suggested lessons</h3>
              <p className="small muted" style={{ margin: 0 }}>These objections keep losing calls. Here is an answer that usually works — change it to your words and add it.</p>
              {suggestions.map((s) => <div key={s.kind} className="stack-sm" style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 8 }}><strong className="small">When {s.situation} <span className="faint">({s.calls - s.saved} of {s.calls} calls lost)</span></strong><SuggestLesson s={s} /></div>)}
            </div>
          )}
          <LineTable title="Lines that lose people" hint="The client hung up right after it, cut in, or the call ended 'not interested'." rows={stats.worst} link={link} />
          <LineTable title="Last line before the client hung up" rows={stats.exits} link={link} />
          <LineTable title="Lines that work" hint="The client answered, and calls with this line ended interested or with a call-back." rows={stats.best} link={link} />
          <div className="panel flush table-wrap">
            <h3 style={{ padding: "14px 16px 0" }}>Calls (last 90 days)</h3>
            <table>
              <thead><tr><th>When</th><th>With</th><th>Result</th><th>Mood</th><th>Lines</th><th /></tr></thead>
              <tbody>
                {list.slice(0, 50).map((c) => (
                  <tr key={c.token}>
                    <td className="small">{fmtDate(c.ended_at)}</td>
                    <td className="small">{c.lead_name || "Test call"}{c.sequence_id ? <div className="tiny faint">{bookName[c.sequence_id]}</div> : null}</td>
                    <td className="small">{OUT[c.outcome] || "No result"}<div className="tiny faint">{c.ended_by === "client" ? "client hung up" : c.ended_by === "ai" ? "AI ended" : ""}</div></td>
                    <td className="small">{(() => { const x = callInsights(c); return <>{MOOD[x.mood]}{x.objections.length ? <div className="tiny faint">{x.objections.map((o) => o.label).join(", ")}</div> : null}</>; })()}</td>
                    <td>{(c.transcript || []).length}</td>
                    <td><Link className="small" href={`/app/leads/playbook/learning?call=${c.token}#call`}>Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="panel flush table-wrap">
        <h3 style={{ padding: "14px 16px 0" }}>Your lessons</h3>
        <table>
          <thead><tr><th>Lesson</th><th>For</th><th /></tr></thead>
          <tbody>
            {!ours.length && <tr><td colSpan={3} className="muted" style={{ padding: 18 }}>No lessons yet — teach one from a call, or add a rule below.</td></tr>}
            {ours.map((l) => (
              <tr key={l.id} style={{ opacity: l.status === "retired" ? 0.55 : 1 }}>
                <td className="small" style={{ maxWidth: 520 }}>
                  {l.situation && <div className="tiny faint">When {l.situation}</div>}
                  {l.bad && <div className="tiny faint">Instead of: {l.bad}</div>}
                  <div>{l.better}</div>
                </td>
                <td className="small">{l.scope === "playbook" ? bookName[l.sequence_id] || "One playbook" : SCOPE[l.scope]}{l.status === "retired" ? <div className="tiny faint">Switched off</div> : null}</td>
                <td>
                  <form action={setLesson} className="row" style={{ gap: 4 }}>
                    <input type="hidden" name="id" value={l.id} />
                    {l.status === "active"
                      ? <><SubmitButton name="action" value="retire" className="ghost sm">Switch off</SubmitButton>
                          <SubmitButton name="action" value="share" className="ghost sm" title="Offer it to every Dhandha customer; the Dhandha team checks it first and removes anything about your company">Share with all</SubmitButton></>
                      : <SubmitButton name="action" value="restore" className="ghost sm">Switch on</SubmitButton>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewLesson playbooks={books || []} />

      <details className="panel">
        <summary><strong>Lessons every Dhandha AI call follows ({shared.length})</strong> <span className="small muted">— the starter pack and lessons approved for all customers</span></summary>
        <ul className="small" style={{ marginTop: 10 }}>
          {shared.map((l) => <li key={l.id} style={{ marginBottom: 6 }}>{l.situation ? <span className="muted">{l.situation}: </span> : null}{l.better}</li>)}
        </ul>
      </details>
    </div>
  );
}
