import FormState from "@/app/app/FormState";
import { logActivity } from "@/app/app/leads/actions";
import { ACTIVITY, OUTCOMES } from "@/lib/leads";
import { ago } from "@/lib/tickets";
import { fmtDate } from "@/lib/session";

const OUTCOME_CHIP = { connected: "ok", interested: "ok", sent: "info", no_answer: "warn", busy: "warn", wrong_number: "bad", not_interested: "mute" };

// Calls, messages, meetings, notes and stage moves, newest first.
export function Timeline({ items, name }) {
  if (!items?.length) return <p className="small muted" style={{ margin: 0 }}>Nothing logged yet. Every call, message and stage move shows up here.</p>;
  return (
    <ol className="reasons" style={{ gap: 12 }}>
      {items.map((a) => (
        <li key={a.id} style={{ display: "block", borderLeft: `3px solid ${a.kind === "stage" ? "var(--marigold)" : "var(--line)"}`, paddingLeft: 12 }}>
          <div className="row tiny" style={{ gap: 8 }}>
            <strong>{ACTIVITY[a.kind]}</strong>
            {a.outcome && <span className={`chip ${OUTCOME_CHIP[a.outcome]}`}>{OUTCOMES[a.outcome]}</span>}
            <span className="faint" title={fmtDate(a.created_at)}>{ago(a.created_at)} · {a.created_by ? name(a.created_by) : "Dhandha"}</span>
          </div>
          {a.body && <p className="small" style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{a.body}</p>}
        </li>
      ))}
    </ol>
  );
}

export function LogActivity({ leadId, dealId, defaultKind = "call" }) {
  return (
    <FormState action={logActivity} submit="Log it">
      {leadId && <input type="hidden" name="lead_id" value={leadId} />}
      {dealId && <input type="hidden" name="deal_id" value={dealId} />}
      <div className="form-grid">
        <div>
          <label htmlFor="kind">What did you do</label>
          <select id="kind" name="kind" defaultValue={defaultKind}>{Object.entries(ACTIVITY).filter(([k]) => k !== "stage").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div>
          <label htmlFor="outcome">Outcome</label>
          <select id="outcome" name="outcome" defaultValue=""><option value="">—</option>{Object.entries(OUTCOMES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
      </div>
      <div><label htmlFor="body">Notes</label><textarea id="body" name="body" rows={2} maxLength={4000} placeholder="What was said, what they need" /></div>
      <div className="form-grid">
        <div><label htmlFor="follow_up">Next follow-up</label><input id="follow_up" name="follow_up" type="date" /></div>
        {dealId && <div><label htmlFor="next_action">Next step</label><input id="next_action" name="next_action" maxLength={120} placeholder="e.g. Send revised quote" /></div>}
      </div>
    </FormState>
  );
}
