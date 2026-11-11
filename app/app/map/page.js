import Link from "next/link";
import { getContext } from "@/lib/session";
import { Sparkline } from "@/components/Charts";
import { nodeCards, agentRows, driftAlerts, flowStages, needsList, connectionRows } from "@/lib/companyMap";
import { automationPause } from "./actions";

export const metadata = { title: "Business map" };

const when = (d) => new Date(d).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

// Dhandha Map (11 Nov, owner chose items 1–5 and 11): the whole business on one screen — the parts of the business around
// the Vault, the automatic agents, live activity, what needs a person, connections and the flow from tender to payment.
export default async function MapPage({ searchParams }) {
  const sp = await searchParams;
  const learn = sp?.learn === "1";
  const { supabase, company, role } = await getContext();
  const { data: map, error } = await supabase.rpc("company_map", { p_company: company.id });
  if (error || !map) return <div className="notice bad">Could not load the map: {error?.message || "no data"}</div>;
  const env = { ai: !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY), razorpay: !!process.env.RAZORPAY_KEY_ID };
  const nodes = nodeCards(map), hub = nodes.find((n) => n.key === "vault"), around = nodes.filter((n) => n.key !== "vault");
  const agents = agentRows(map.agents || []);
  const needs = needsList(map.needs || {}, map.role);
  const conns = connectionRows(map.connections || {}, env);
  const flow = flowStages(map.flow || {});
  const drifts = driftAlerts(map.series || {});
  const canPause = ["admin", "manager"].includes(role);
  const salesMax = Math.max(1, ...flow.sales.map((s) => s.n));

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Business map</h1><p>Your whole business on one screen — what each part is doing, what runs by itself and what needs you.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <Link href={learn ? "/app/map" : "/app/map?learn=1"} className={`btn sm ${learn ? "" : "ghost"}`}>{learn ? "✓ Learn mode" : "Learn mode"}</Link>
          {canPause && (
            <form action={automationPause}>
              <input type="hidden" name="on" value={map.paused ? "0" : "1"} />
              <button className={`btn sm ${map.paused ? "" : "ghost"}`}>{map.paused ? "▶ Resume automation" : "⏸ Pause all automation"}</button>
            </form>
          )}
        </div>
      </div>

      {map.paused && <div className="notice bad small"><strong>Automation paused since {when(map.paused)}.</strong> Autopilot, AI check, playbooks, win-back and review requests are off until you resume. Alerts still come.</div>}
      {drifts.map((d) => <div key={d.key} className={`notice ${d.tone} small`}>{d.text}</div>)}

      {/* 1. the map: parts of the business around the Vault */}
      <div className="bmap">
        <svg className="bmap-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[[16, 12], [50, 12], [84, 12], [16, 50], [84, 50], [16, 88], [50, 88], [84, 88]].map(([x, y], i) => <line key={i} x1="50" y1="50" x2={x} y2={y} />)}
        </svg>
        {around.map((n, i) => <MapNode key={n.key} n={n} learn={learn} slot={i} />)}
        <MapNode n={hub} learn={learn} hub />
      </div>

      {/* 11. the flow */}
      <div className="panel stack-sm">
        <h2 style={{ margin: 0 }}>From tender to payment</h2>
        {learn && <p className="small muted" style={{ margin: 0 }}>Each step's count. A red number means work is stuck there.</p>}
        <div className="flow-steps">
          {flow.tenders.map((s, i) => (
            <Link key={s.key} href={s.href} className={`flow-step ${s.stuck ? "stuck" : ""}`} title={s.learn}>
              <span className="flow-n">{s.n}</span>
              <span className="flow-label">{s.label}</span>
              {s.stuck > 0 && <span className="chip bad">{s.stuck} stuck</span>}
              {learn && <span className="faint" style={{ fontSize: 11.5 }}>{s.learn}</span>}
              {i < flow.tenders.length - 1 && <span className="flow-arrow" aria-hidden="true">→</span>}
            </Link>
          ))}
        </div>
        <h3 style={{ margin: "8px 0 0" }}>Sales funnel</h3>
        <div className="funnel">
          {flow.sales.map((s) => (
            <Link key={s.key} href={`/app/crm?stage=${s.key}`} className="funnel-row">
              <span className="small">{s.label}</span>
              <span className="funnel-bar"><span style={{ width: `${Math.max(2, (s.n / salesMax) * 100)}%` }} /></span>
              <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>{s.n}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid-3">
        {/* 4. needs your call */}
        <div className="panel stack-sm">
          <h2 style={{ margin: 0 }}>Needs your call {needs.length > 0 && <span className="chip bad">{needs.length}</span>}</h2>
          {learn && <p className="small muted" style={{ margin: 0 }}>Things that wait for a person: bids closing, your tasks, accepted quotations, chats nobody has taken.</p>}
          {!needs.length && <p className="small muted" style={{ margin: 0 }}>Nothing waiting on you. 🎉</p>}
          {needs.map((x) => (
            <div key={x.key} className="row" style={{ justifyContent: "space-between", gap: 8 }}>
              <span className="small"><span className={`chip ${x.tone}`} style={{ marginRight: 6 }}> </span>{x.text}</span>
              <Link href={x.href} className="btn sm ghost">{x.act}</Link>
            </div>
          ))}
        </div>

        {/* 3. live activity */}
        <div className="panel stack-sm">
          <h2 style={{ margin: 0 }}>Live activity</h2>
          {learn && <p className="small muted" style={{ margin: 0 }}>Everything that happened in the last 48 hours — by your team and by Dhandha's agents.</p>}
          <div className="activity-feed">
            {!(map.activity || []).length && <p className="small muted">Nothing in the last 48 hours.</p>}
            {(map.activity || []).map((a, i) => (
              <div key={i} className="activity-item">
                <span className={`activity-dot k-${a.kind}`} />
                <div style={{ minWidth: 0 }}>
                  {a.href ? <Link href={a.href} className="small">{a.text}</Link> : <span className="small">{a.text}</span>}
                  <div className="faint" style={{ fontSize: 11.5 }}>{when(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. agents */}
        <div className="panel stack-sm">
          <h2 style={{ margin: 0 }}>Agents</h2>
          {learn && <p className="small muted" style={{ margin: 0 }}>Workers that run by themselves. Green = on, amber = had failures, grey = off.</p>}
          {agents.map((a) => (
            <Link key={a.key} href={a.href} className="agent-row" title={a.learn}>
              <span className={`agent-dot ${map.paused && a.state === "on" ? "off" : a.state}`} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="small" style={{ fontWeight: 600 }}>{a.label}</div>
                <div className="faint" style={{ fontSize: 11.5 }}>{a.on ? `${a.did ?? 0} ${a.unit} · ${a.ago}` : "off"}{a.failed ? ` · ${a.failed} failed` : ""}</div>
                {learn && <div className="faint" style={{ fontSize: 11.5 }}>{a.learn}</div>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* 5. always on */}
      <div className="panel stack-sm">
        <h2 style={{ margin: 0 }}>Always on</h2>
        {learn && <p className="small muted" style={{ margin: 0 }}>The connections Dhandha uses. Grey ones are not set up yet — tap to set them up.</p>}
        <div className="conn-grid">
          {conns.map((c) => {
            const body = <><span className={`agent-dot ${c.state}`} /><span className="small" style={{ fontWeight: 600 }}>{c.label}</span><span className="faint" style={{ fontSize: 11.5 }}>{c.note}</span></>;
            return c.href ? <Link key={c.key} href={c.href} className="conn">{body}</Link> : <div key={c.key} className="conn">{body}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

function MapNode({ n, learn, hub, slot }) {
  return (
    <Link href={n.href} className={`bmap-node ${hub ? "hub" : `s${slot}`} ${n.tone ? `t-${n.tone}` : ""}`}>
      <div className="row" style={{ justifyContent: "space-between", gap: 6 }}>
        <span className="kpi-label" style={{ margin: 0 }}>{n.label}</span>
        {n.alert && <span className={`chip ${n.tone || "warn"}`}>{n.alert}</span>}
      </div>
      <div className="bmap-big">{n.big}</div>
      <div className="faint" style={{ fontSize: 11.5 }}>{n.bigLabel}</div>
      {n.series && <Sparkline points={n.series} height={28} label={`${n.label}, last 8 days`} />}
      <div className="faint" style={{ fontSize: 11.5 }}>{n.lines.join(" · ")}</div>
      {learn && <div className="bmap-learn">{n.learn}</div>}
    </Link>
  );
}
