import Link from "next/link";
import { getContext, lakh } from "@/lib/session";
import { leaderboard, teamTotals, monthProgress, pct } from "@/lib/targets";
import FormState from "../../FormState";
import { saveTarget } from "./actions";

export const metadata = { title: "Targets & leaderboard" };

const ROLE = { admin: "Admin", manager: "Manager", telecaller: "Telecaller", field: "Field sales", bid_preparer: "Bid preparer" };

function Bar({ value, tone }) {
  const v = Math.min(100, Math.max(0, value || 0));
  return <div style={{ height: 6, borderRadius: 3, background: "var(--line-soft)", marginTop: 4 }}><div style={{ width: `${v}%`, height: 6, borderRadius: 3, background: tone || "var(--primary)" }} /></div>;
}

function Cell({ actual, target, fmt = (x) => x }) {
  const p = pct(actual, target);
  return <td className="small num">{fmt(actual || 0)}{target ? <span className="tiny faint"> / {fmt(target)}</span> : null}{p !== null && <Bar value={p} tone={p >= 100 ? "var(--ok)" : undefined} />}</td>;
}

export default async function Targets({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const now = new Date(Date.now() + 330 * 60000);
  const m = /^\d{4}-\d{2}$/.test(sp?.m || "") ? sp.m : now.toISOString().slice(0, 7);
  const month = `${m}-01`;
  const { data: rows, error } = await supabase.rpc("team_month", { p_company: company.id, p_month: month });
  const people = leaderboard(rows || [], month);
  const tot = teamTotals(people);
  const prog = Math.round(monthProgress(month) * 100);
  const isLead = ["admin", "manager"].includes(role);
  const shift = (k) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const label = new Date(`${month}T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="stack">
      <Link href="/app/crm" className="small">CRM pipeline</Link>
      <div className="page-head">
        <div>
          <h1>Targets &amp; leaderboard</h1>
          <p>Each person&apos;s month: business won, meetings, new deals and calls/notes logged against the target, and a forecast from their open deals (weighted by stage).</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn ghost sm" href={`/app/crm/targets?m=${shift(-1)}`}>‹</Link>
          <strong>{label}</strong>
          <Link className="btn ghost sm" href={`/app/crm/targets?m=${shift(1)}`}>›</Link>
        </div>
      </div>
      {error && <p className="error">{error.message}</p>}

      <div className="grid-3">
        <div className="panel"><div className="tiny faint">Won this month</div><div style={{ fontSize: 24, fontWeight: 700 }}>{lakh(tot.won)}</div>{tot.target > 0 && <><div className="tiny faint">of {lakh(tot.target)} target · {pct(tot.won, tot.target)}%</div><Bar value={pct(tot.won, tot.target)} /></>}</div>
        <div className="panel"><div className="tiny faint">Forecast (won + likely from open deals)</div><div style={{ fontSize: 24, fontWeight: 700 }}>{lakh(tot.forecast)}</div>{tot.target > 0 && <div className="tiny faint">{pct(tot.forecast, tot.target)}% of target</div>}</div>
        <div className="panel"><div className="tiny faint">Month gone</div><div style={{ fontSize: 24, fontWeight: 700 }}>{prog}%</div><div className="tiny faint">{tot.meetings} meetings · {tot.deals} new deals · {tot.activities} calls/notes</div></div>
      </div>

      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>#</th><th>Person</th><th>Won</th><th>Meetings</th><th>New deals</th><th>Calls / notes</th><th>Forecast</th><th>Status</th></tr></thead>
          <tbody>
            {people.map((p, i) => (
              <tr key={p.user_id}>
                <td>{i === 0 && (p.score || p.points) ? "🏆" : i + 1}</td>
                <td><strong>{p.name}</strong><div className="tiny faint">{ROLE[p.role] || p.role}{p.score === null ? ` · ${p.points} points` : ` · ${p.score}% of targets`}</div></td>
                <Cell actual={Number(p.won_value)} target={Number(p.t_won) || 0} fmt={lakh} />
                <Cell actual={p.meetings} target={p.t_meetings} />
                <Cell actual={p.new_deals} target={p.t_deals} />
                <Cell actual={p.activities} target={p.t_activities} />
                <td className="small num">{lakh(p.forecast)}{p.forecastPct !== null && <div className="tiny faint">{p.forecastPct}% of target</div>}</td>
                <td className="small">{p.onTrack === null ? <span className="chip mute">No target</span> : p.onTrack ? <span className="chip ok">On track</span> : <span className="chip warn">Behind</span>}</td>
              </tr>
            ))}
            {!people.length && <tr><td colSpan={8} className="muted small">No sales team members yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Won = deals moved to Won this month (owner). Meetings = booked meetings of the person&apos;s sales-team calendar. Calls / notes = timeline entries they logged. Forecast weights open deals: proposal 60%, negotiation 80%, meeting 40% and so on. Without targets, people are ranked by points (₹1 lakh won = 10, meeting = 3, new deal = 2, call/note = 1).</p>

      {isLead && (
        <details className="panel">
          <summary><strong>Set targets for {label}</strong></summary>
          <div className="stack-sm" style={{ marginTop: 10 }}>
            {people.map((p) => (
              <FormState key={p.user_id} action={saveTarget} submit="Save" className="stack-sm">
                <input type="hidden" name="user" value={p.user_id} /><input type="hidden" name="month" value={month} />
                <div className="row" style={{ gap: 8, alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 140px" }}><strong className="small">{p.name}</strong></div>
                  <div style={{ flex: "1 1 120px" }}><label>Won (₹)</label><input name="won" inputMode="numeric" defaultValue={Number(p.t_won) || ""} /></div>
                  <div style={{ flex: "0 1 90px" }}><label>Meetings</label><input name="meetings" inputMode="numeric" defaultValue={p.t_meetings || ""} /></div>
                  <div style={{ flex: "0 1 90px" }}><label>New deals</label><input name="deals" inputMode="numeric" defaultValue={p.t_deals || ""} /></div>
                  <div style={{ flex: "0 1 100px" }}><label>Calls / notes</label><input name="activities" inputMode="numeric" defaultValue={p.t_activities || ""} /></div>
                </div>
              </FormState>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
