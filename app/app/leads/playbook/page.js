import Link from "next/link";
import { getContext } from "@/lib/session";
import { summary, delayText, DAYS } from "@/lib/playbook";
import { SOURCES } from "@/lib/leads";
import SourceTabs from "@/components/SourceTabs";
import SubmitButton from "@/components/SubmitButton";
import { createPlaybook, setPlaybookActive } from "./actions";

export const metadata = { title: "Lead Playbook" };

const days = (d) => (!d?.length ? "any day" : d.length === 7 ? "every day" : DAYS.filter(([n]) => d.includes(n)).map(([, l]) => l).join(", "));

export default async function Playbooks() {
  const { supabase, company, role } = await getContext();
  const [{ data: books }, { data: enr }, { data: calls }] = await Promise.all([
    supabase.from("sequences").select("id, name, active, trigger, trigger_sources, office_from, office_to, office_days, created_at, sequence_steps(step_no, channel, delay_minutes, day_offset)").eq("company_id", company.id).order("created_at"),
    supabase.from("enrollments").select("sequence_id, status").eq("company_id", company.id),
    supabase.from("ai_calls").select("status").eq("company_id", company.id).gte("created_at", new Date(Date.now() - 30 * 864e5).toISOString()),
  ]);
  const count = (id, st) => (enr || []).filter((e) => e.sequence_id === id && e.status === st).length;
  const isLead = ["admin", "manager"].includes(role);
  const waiting = (calls || []).filter((c) => c.status === "waiting_provider").length;

  return (
    <div className="stack">
      <SourceTabs />
      <div className="page-head">
        <div>
          <h1>Lead Playbook</h1>
          <p>Decide exactly what happens to every new lead, step by step: an AI call in the lead's language, WhatsApp, email, a booking link, a task for your team — in any order, with waits in between, only during your office hours. A playbook stops by itself when someone logs a call or meeting, or the lead books a time.</p>
        </div>
        {isLead && <Link href="/app/leads/playbook/learning" className="btn ghost">Call learning</Link>}
      </div>

      {waiting > 0 && (
        <div className="notice">AI calling is not connected yet, so {waiting} AI call{waiting === 1 ? "" : "s"} in the last 30 days became call tasks for your team with the same script. They will be made by the AI once calling is switched on.</div>
      )}

      <div className="panel flush table-wrap">
        <table>
          <thead><tr><th>Playbook</th><th>Starts</th><th>Office hours</th><th>In progress</th><th>Done</th><th>Stopped by a reply</th><th></th></tr></thead>
          <tbody>
            {!(books || []).length && <tr><td colSpan={7} className="muted" style={{ padding: 22 }}>No playbook yet. Start from the ready-made one below and change it as you like.</td></tr>}
            {(books || []).map((b) => {
              const steps = [...(b.sequence_steps || [])].sort((x, y) => x.step_no - y.step_no);
              return (
                <tr key={b.id}>
                  <td>
                    <Link href={`/app/leads/playbook/${b.id}`}><strong>{b.name}</strong></Link>
                    {!b.active && <span className="chip mute" style={{ marginLeft: 8 }}>Off</span>}
                    <div className="tiny faint">{summary(steps) || "No steps yet"}</div>
                    {steps[0] && <div className="tiny faint">First step {delayText(steps[0].delay_minutes ?? steps[0].day_offset * 1440)}</div>}
                  </td>
                  <td className="small">{b.trigger === "new_lead" ? <>On every new lead{b.trigger_sources?.length ? <> from {b.trigger_sources.map((s) => SOURCES[s] || s).join(", ")}</> : ""}</> : "When you start it for leads"}</td>
                  <td className="small">{String(b.office_from).slice(0, 5)}–{String(b.office_to).slice(0, 5)}<div className="tiny faint">{days(b.office_days)}</div></td>
                  <td>{count(b.id, "active")}</td><td>{count(b.id, "completed")}</td><td>{count(b.id, "replied")}</td>
                  <td>
                    {isLead && (
                      <form action={setPlaybookActive}>
                        <input type="hidden" name="id" value={b.id} /><input type="hidden" name="active" value={b.active ? "0" : "1"} />
                        <SubmitButton className="ghost sm">{b.active ? "Switch off" : "Switch on"}</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isLead && (
        <div className="panel">
          <h3>New playbook</h3>
          <p className="muted small">The ready-made one: AI call 5 minutes after the lead arrives → WhatsApp after an hour → email next day → booking link two days later → a follow-up task for the owner. Every step can be changed, moved, removed, or more added.</p>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <form action={createPlaybook}><input type="hidden" name="from" value="starter" /><SubmitButton>Start from the ready-made playbook</SubmitButton></form>
            <form action={createPlaybook}><input type="hidden" name="from" value="blank" /><SubmitButton className="ghost">Start empty</SubmitButton></form>
          </div>
        </div>
      )}
    </div>
  );
}
