import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, fmtDate } from "@/lib/session";
import FormState from "../../FormState";
import { SOURCES } from "@/lib/leads";
import { saveStep, removeStep, toggleSequence, enrollByFilter, setEnrollment } from "../actions";

const ENR = { active: ["info", "Active"], paused: ["warn", "Paused"], completed: ["mute", "Finished"], stopped: ["mute", "Stopped"], replied: ["ok", "Replied"] };

function StepForm({ seq, step, next }) {
  const s = step || { step_no: next, day_offset: next === 1 ? 0 : 3 * (next - 1), channel: "email", wa_lang: "en" };
  return (
    <FormState action={saveStep} submit={step ? "Save step" : "Add step"}>
      <input type="hidden" name="sequence_id" value={seq} />
      <div className="form-grid">
        <div><label>Step</label><input name="step_no" type="number" min={1} max={10} defaultValue={s.step_no} /></div>
        <div><label>Day (from enrolment)</label><input name="day_offset" type="number" min={0} max={90} defaultValue={s.day_offset} /></div>
        <div><label>Channel</label><select name="channel" defaultValue={s.channel}><option value="email">Email</option><option value="whatsapp">WhatsApp template</option></select></div>
      </div>
      <div><label>Email subject</label><input name="subject" defaultValue={s.subject || ""} maxLength={200} /></div>
      <div><label>Email message</label><textarea name="body" rows={6} defaultValue={s.body || ""} maxLength={5000} /></div>
      <div className="form-grid">
        <div><label>WhatsApp template name</label><input name="wa_template" defaultValue={s.wa_template || ""} placeholder="intro_offer" /></div>
        <div><label>Template language</label><input name="wa_lang" defaultValue={s.wa_lang || "en"} placeholder="en, hi, en_US" /></div>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>For WhatsApp, fill the template fields and leave the email fields empty. The template must be approved in WhatsApp Manager; Dhandha fills {"{{1}}"} with the person&apos;s first name and {"{{2}}"} with your company name.</p>
    </FormState>
  );
}

export default async function Sequence({ params }) {
  const { id } = await params;
  const { supabase, company, role } = await getContext();
  const { data: seq } = await supabase.from("sequences").select("*").eq("id", id).eq("company_id", company.id).maybeSingle();
  if (!seq) notFound();
  const [{ data: steps }, { data: enr }] = await Promise.all([
    supabase.from("sequence_steps").select("*").eq("sequence_id", id).order("step_no"),
    supabase.from("enrollments").select("id, status, next_step, next_at, stopped_reason, enrolled_at, leads(id, name, email, phone)").eq("sequence_id", id).order("enrolled_at", { ascending: false }).limit(300),
  ]);
  const isLead = ["admin", "manager"].includes(role);
  const canWrite = role !== "viewer";
  const nextNo = Math.min(10, ((steps || []).at(-1)?.step_no || 0) + 1);

  return (
    <div className="stack">
      <Link href="/app/outreach" className="small">Outreach</Link>
      <div className="page-head">
        <div><h1>{seq.name}</h1><p>{(steps || []).length} steps · {(enr || []).filter((e) => e.status === "active").length} leads active</p></div>
        {isLead && (
          <form action={toggleSequence}><input type="hidden" name="id" value={seq.id} /><input type="hidden" name="active" value={seq.active ? "0" : "1"} />
            <button className={seq.active ? "ghost" : "gold"}>{seq.active ? "Switch off" : "Switch on"}</button></form>
        )}
      </div>
      {!seq.active && <div className="notice small"><span>This sequence is switched off: nothing is sent and no one new can be enrolled.</span></div>}

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm">
          {(steps || []).map((s) => (
            <details key={s.id} className="panel">
              <summary><strong>Step {s.step_no} · day {s.day_offset} · {s.channel === "email" ? `Email: ${s.subject}` : `WhatsApp: ${s.wa_template}`}</strong></summary>
              {isLead ? <>
                <StepForm seq={seq.id} step={s} />
                <form action={removeStep} style={{ marginTop: 8 }}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="sequence_id" value={seq.id} /><button className="danger">Remove step</button></form>
              </> : <p className="small" style={{ whiteSpace: "pre-wrap" }}>{s.body}</p>}
            </details>
          ))}
          {isLead && (steps || []).length < 10 && <details className="panel" open={!(steps || []).length}><summary><strong>Add a step</strong></summary><StepForm seq={seq.id} next={nextNo} /></details>}
        </div>

        <div className="stack-sm">
          {canWrite && seq.active && (
            <div className="panel">
              <h3>Enrol leads</h3>
              <FormState action={enrollByFilter} submit="Enrol">
                <input type="hidden" name="sequence_id" value={seq.id} />
                <div className="form-grid">
                  <div><label htmlFor="filter">Which leads</label>
                    <select id="filter" name="filter" defaultValue="new">
                      <option value="new">Not contacted yet</option><option value="hot">Hot (score 70+)</option><option value="open">All open leads</option>
                      {Object.entries(SOURCES).map(([k, l]) => <option key={k} value={`source:${k}`}>Source: {l}</option>)}
                    </select></div>
                  <div><label htmlFor="needs">Only if they have</label>
                    <select id="needs" name="needs" defaultValue="email"><option value="email">an email</option><option value="whatsapp">WhatsApp opt-in</option><option value="">either</option></select></div>
                </div>
                <p className="tiny faint" style={{ margin: 0 }}>Up to 1,000 at a time. Do-not-disturb, closed and already-enrolled leads are left out. Steps a lead cannot receive (no email, no WhatsApp opt-in) are skipped for that lead.</p>
              </FormState>
            </div>
          )}
          <div className="panel flush table-wrap">
            <table>
              <thead><tr><th>Lead</th><th>Status</th><th>Next</th><th /></tr></thead>
              <tbody>
                {!(enr || []).length && <tr><td colSpan={4} className="muted" style={{ padding: 18 }}>No one enrolled yet.</td></tr>}
                {(enr || []).map((e) => (
                  <tr key={e.id}>
                    <td className="small"><Link href={`/app/leads/${e.leads?.id}`}>{e.leads?.name}</Link><div className="tiny faint">{e.leads?.email || e.leads?.phone}</div></td>
                    <td><span className={`chip ${ENR[e.status][0]}`}>{ENR[e.status][1]}</span>{e.stopped_reason && <div className="tiny faint">{e.stopped_reason}</div>}</td>
                    <td className="small">{e.status === "active" && e.next_at ? `Step ${e.next_step} · ${fmtDate(e.next_at)}` : "—"}</td>
                    <td>{canWrite && ["active", "paused"].includes(e.status) && (
                      <form action={setEnrollment} className="row" style={{ gap: 4 }}>
                        <input type="hidden" name="id" value={e.id} /><input type="hidden" name="sequence_id" value={seq.id} />
                        <button name="status" value={e.status === "active" ? "paused" : "active"} className="ghost sm">{e.status === "active" ? "Pause" : "Resume"}</button>
                        <button name="status" value="stopped" className="ghost sm">Stop</button>
                      </form>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
