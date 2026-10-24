"use client";
import { useActionState, useState } from "react";
import { saveAutopilot, runAutopilotNow } from "../autopilotActions";
import { AUTO_SOURCES, costPerLead, budgetPlan } from "@/lib/autopilot";
import { Spinner } from "@/components/Progress";

const inr = (n) => `₹${Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

// Autopilot settings with a live estimate: the daily budget, the sources, and what that buys.
export default function AutopilotForm({ a, sequences, types, prices, balance, canEdit, callReady }) {
  const [state, action, pending] = useActionState(saveAutopilot, {});
  const [budget, setBudget] = useState(Number(a.daily_budget ?? 100));
  const [sources, setSources] = useState(a.sources || ["google_maps"]);
  const [seq, setSeq] = useState(a.sequence_id || "");
  const [call, setCall] = useState(!!a.call_enabled && callReady);
  const [queries, setQueries] = useState(a.maps_queries?.length ? a.maps_queries : [{ what: "", areas: "" }]);
  const [run, setRun] = useState(null);
  const steps = sequences.find((s) => s.id === seq)?.sequence_steps || [];
  const per = costPerLead({ find: prices.lead_found ?? 2, steps, call, prices });
  const plan = budgetPlan(budget, sources, per);
  const toggle = (c) => setSources((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  const label = Object.fromEntries(AUTO_SOURCES.map((s) => [s.code, s.label]));

  async function runNow() {
    setRun("busy");
    const r = await runAutopilotNow();
    setRun(r.error ? { error: r.error } : { ok: "Started — new leads appear in a minute or two. Refresh to see them." });
  }

  return (
    <form action={action} className="stack">
      <fieldset disabled={!canEdit} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="panel stack-sm">
          <label className="row" style={{ gap: 10, margin: 0, fontWeight: 600 }}><input type="checkbox" name="active" defaultChecked={a.active} style={{ width: "auto" }} /> Autopilot on — find, score and contact new leads every morning</label>
          <div className="form-grid">
            <div><label htmlFor="ap-budget">Daily budget (₹ / credits)</label>
              <input id="ap-budget" name="daily_budget" type="number" min={0} max={100000} step={10} value={budget} onChange={(e) => setBudget(Number(e.target.value))} /></div>
            <div><label htmlFor="ap-min">Only keep leads scoring at least</label><input id="ap-min" name="min_score" type="number" min={0} max={100} defaultValue={a.min_score ?? 0} /></div>
          </div>
          <input type="range" min={0} max={2000} step={10} value={Math.min(budget, 2000)} onChange={(e) => setBudget(Number(e.target.value))} aria-label="Daily budget" />
          <div className="notice info" style={{ display: "block" }}>
            <strong>{plan.total} new leads a day</strong> <span className="small">(about {plan.monthly} a month) at about {inr(per)} each</span>
            <div className="small">{plan.split.map((s) => `${label[s.source]}: ${s.leads}`).join(" · ") || "Pick a source below."}</div>
            <div className="tiny faint">Each lead: {inr(prices.lead_found ?? 2)} to find{steps.length ? ` + ${steps.length} message${steps.length > 1 ? "s" : ""} in your sequence` : ""}{call ? " + a 2-minute AI call" : ""}. Credits left: {inr(balance)}{balance < plan.spend ? " — top up to use the full budget" : ""}. A day with fewer good leads spends less.</div>
          </div>
        </div>

        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Where to find them</h3>
          {AUTO_SOURCES.map((s) => (
            <label key={s.code} className="row" style={{ gap: 10, margin: 0, alignItems: "flex-start", fontWeight: 500 }}>
              <input type="checkbox" name="sources" value={s.code} checked={sources.includes(s.code)} onChange={() => toggle(s.code)} style={{ width: "auto", marginTop: 3 }} />
              <span><strong>{s.label}</strong> <span className="tiny faint">{inr(s.find)} a lead</span><br /><span className="small muted">{s.note}</span></span>
            </label>
          ))}
          {sources.includes("google_maps") && (
            <div className="stack-sm" style={{ paddingLeft: 26 }}>
              <span className="small" style={{ fontWeight: 600 }}>Google Maps searches</span>
              {queries.map((q, i) => (
                <div key={i} className="form-grid">
                  <div><label>What they are</label><input name="what" defaultValue={q.what} placeholder="restaurant / manufacturer / school" /></div>
                  <div><label>Areas (separate with ;)</label><input name="areas" defaultValue={q.areas} placeholder="Sector 18, Noida; Gurugram; Faridabad" /></div>
                </div>
              ))}
              {queries.length < 5 && <div><button type="button" className="sm ghost" onClick={() => setQueries((x) => [...x, { what: "", areas: "" }])}>+ Another search</button></div>}
            </div>
          )}
          <p className="tiny faint" style={{ margin: 0 }}>Tender winners and new companies follow the industries, states and cities in “Ideal client” on <a href="/app/leads">Your leads</a>. Facebook / Instagram ads, LinkedIn, Apollo and imports keep arriving on their own and count in the results too.</p>
        </div>

        <div className="panel stack-sm">
          <h3 style={{ margin: 0 }}>Then, automatically</h3>
          <div className="form-grid">
            <div><label htmlFor="ap-seq">1. Message them with this sequence</label>
              <select id="ap-seq" name="sequence_id" value={seq} onChange={(e) => setSeq(e.target.value)}>
                <option value="">— don't message —</option>
                {sequences.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.sequence_steps.length} steps{s.active ? "" : ", off"})</option>)}
              </select></div>
            <div><label htmlFor="ap-link">2. Offer</label>
              <select id="ap-link" name="link_kind" defaultValue={a.link_kind || "meeting"}>
                <option value="meeting">A meeting (booking link)</option><option value="payment">A payment link</option><option value="none">Nothing yet</option>
              </select></div>
            <div><label htmlFor="ap-type">Meeting type for the link</label>
              <select id="ap-type" name="meeting_type_id" defaultValue={a.meeting_type_id || ""}><option value="">—</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <label className="row" style={{ gap: 10, margin: 0, fontWeight: 500 }}>
            <input type="checkbox" name="call_enabled" checked={call} disabled={!callReady} onChange={(e) => setCall(e.target.checked)} style={{ width: "auto" }} />
            AI call to leads that open or reply {callReady ? "" : <span className="tiny faint">(AI calling is being set up)</span>}
          </label>
          <label className="row" style={{ gap: 10, margin: 0, fontWeight: 500 }}><input type="checkbox" name="crm_auto" defaultChecked={a.crm_auto ?? true} style={{ width: "auto" }} /> Run the CRM pipeline automatically (every lead gets a deal that moves itself: New → Messaged → Called → Link sent → Meeting → Won)</label>
        </div>
      </fieldset>
      {state?.error && <p className="error" style={{ margin: 0 }}>{state.error}</p>}
      {state?.message && <p className="success small" style={{ margin: 0 }}>{state.message}</p>}
      {canEdit && (
        <div className="row" style={{ gap: 8 }}>
          <button disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save"}</button>
          {a.active && <button type="button" className="ghost" disabled={run === "busy"} aria-busy={run === "busy"} onClick={runNow}>Run today's batch now</button>}
          {run === "busy" && <Spinner label="Starting the run…" />}
        </div>
      )}
      {run?.error && <p className="error small" style={{ margin: 0 }}>{run.error}</p>}
      {run?.ok && <p className="success small" style={{ margin: 0 }}>{run.ok}</p>}
      {!canEdit && <p className="small muted" style={{ margin: 0 }}>Only the workspace admin can change the autopilot.</p>}
    </form>
  );
}
