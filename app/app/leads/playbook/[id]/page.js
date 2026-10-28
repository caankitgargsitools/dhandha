import Link from "next/link";
import { notFound } from "next/navigation";
import { getContext, fmtDate } from "@/lib/session";
import { stepToForm, STARTER } from "@/lib/playbook";
import { SOURCES } from "@/lib/leads";
import { emailReady } from "@/lib/outreach";
import Builder from "./Builder";
import FormState from "../../../FormState";
import SubmitButton from "@/components/SubmitButton";
import { enrollByFilter, setEnrollment } from "@/app/app/outreach/actions";

export const metadata = { title: "Lead Playbook" };

const CALL = { queued: "Waiting to call", waiting_provider: "Became a call task (AI calling not connected yet)", calling: "Calling", done: "Done", failed: "Failed", cancelled: "Cancelled" };

export default async function Playbook({ params, searchParams }) {
  const { id } = await params;
  const starter = (await searchParams)?.starter === "1";
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: book }, { data: steps }, { data: types }, { data: settings }, { data: enr }, { data: calls }] = await Promise.all([
    supabase.from("sequences").select("*").eq("id", id).eq("company_id", company.id).maybeSingle(),
    supabase.from("sequence_steps").select("*").eq("sequence_id", id).order("step_no"),
    supabase.from("meeting_types").select("id, name, mode, duration_min").eq("company_id", company.id).order("name"),
    supabase.from("outreach_settings").select("wa_connected_at").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("enrollments").select("id, status, next_step, next_at, stopped_reason, enrolled_at, leads(id, name)").eq("sequence_id", id).order("enrolled_at", { ascending: false }).limit(100),
    supabase.from("ai_calls").select("id, status, outcome, language, voice, created_at, leads(id, name)").eq("company_id", company.id).order("created_at", { ascending: false }).limit(20),
  ]);
  if (!book) notFound();
  const initial = {
    name: book.name, description: book.description || "", active: book.active, trigger: book.trigger, trigger_sources: book.trigger_sources || [],
    office_from: String(book.office_from).slice(0, 5), office_to: String(book.office_to).slice(0, 5), office_days: book.office_days || [],
    steps: (steps || []).length ? steps.map(stepToForm) : starter ? STARTER.steps.map((s) => ({ ...s })) : [],
  };
  if (starter && !(steps || []).length) Object.assign(initial, { name: STARTER.name, trigger: STARTER.trigger });
  const canEdit = ["admin", "manager"].includes(role);

  return (
    <div className="stack">
      <div className="page-head">
        <div><Link href="/app/leads/playbook" className="small">← All playbooks</Link><h1>{book.name}</h1></div>
      </div>
      <Builder id={id} initial={initial} unsaved={!(steps || []).length} canEdit={canEdit} sources={SOURCES} meetingTypes={types || []}
        channels={{ email: emailReady(), whatsapp: !!settings?.wa_connected_at, ai: false }} />

      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="stack-sm">
          {role !== "viewer" && book.active && (
            <div className="panel">
              <h3>Start it for leads you already have</h3>
              <FormState action={enrollByFilter} submit="Start">
                <input type="hidden" name="sequence_id" value={id} />
                <div className="form-grid">
                  <div><label htmlFor="filter">Which leads</label>
                    <select id="filter" name="filter" defaultValue="new">
                      <option value="new">Not contacted yet</option><option value="hot">Hot (score 70+)</option><option value="open">All open leads</option>
                      {Object.entries(SOURCES).map(([k, l]) => <option key={k} value={`source:${k}`}>Source: {l}</option>)}
                    </select></div>
                  <div><label htmlFor="needs">Only if they have</label>
                    <select id="needs" name="needs" defaultValue=""><option value="">anything</option><option value="email">an email</option><option value="whatsapp">WhatsApp opt-in</option></select></div>
                </div>
                <p className="tiny faint" style={{ margin: 0 }}>Up to 1,000 at a time. Do-not-disturb, closed and already-started leads are left out; steps a lead cannot receive are skipped for that lead.</p>
              </FormState>
            </div>
          )}
          <div className="panel flush table-wrap">
            <h3 style={{ padding: "14px 16px 0" }}>Leads in this playbook</h3>
            <table>
              <thead><tr><th>Lead</th><th>Status</th><th>Next step</th><th /></tr></thead>
              <tbody>
                {!(enr || []).length && <tr><td colSpan={4} className="muted" style={{ padding: 18 }}>No leads yet.</td></tr>}
                {(enr || []).map((e) => (
                  <tr key={e.id}>
                    <td>{e.leads ? <Link href={`/app/leads/${e.leads.id}`}>{e.leads.name}</Link> : "—"}<div className="tiny faint">Started {fmtDate(e.enrolled_at)}</div></td>
                    <td className="small">{e.status === "active" ? "In progress" : e.status === "replied" ? "Stopped — conversation logged" : e.status === "paused" ? "Paused" : e.status === "completed" ? "Finished" : "Stopped"}{e.stopped_reason && e.status !== "replied" ? <div className="tiny faint">{e.stopped_reason}</div> : null}</td>
                    <td className="small">{e.status === "active" && e.next_at ? <>Step {e.next_step} · {new Date(e.next_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}</> : "—"}</td>
                    <td>{role !== "viewer" && ["active", "paused"].includes(e.status) && (
                      <form action={setEnrollment} className="row" style={{ gap: 4 }}>
                        <input type="hidden" name="id" value={e.id} /><input type="hidden" name="sequence_id" value={id} />
                        <SubmitButton name="status" value={e.status === "active" ? "paused" : "active"} className="ghost sm">{e.status === "active" ? "Pause" : "Resume"}</SubmitButton>
                        <SubmitButton name="status" value="stopped" className="ghost sm">Stop</SubmitButton>
                      </form>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel flush table-wrap">
          <h3 style={{ padding: "14px 16px 0" }}>Recent AI calls</h3>
          <table>
            <thead><tr><th>Lead</th><th>Call</th><th>Result</th></tr></thead>
            <tbody>
              {!(calls || []).length && <tr><td colSpan={3} className="muted" style={{ padding: 18 }}>No AI calls yet.</td></tr>}
              {(calls || []).map((c) => (
                <tr key={c.id}>
                  <td>{c.leads ? <Link href={`/app/leads/${c.leads.id}`}>{c.leads.name}</Link> : "—"}<div className="tiny faint">{fmtDate(c.created_at)}</div></td>
                  <td className="small">{c.voice === "male" ? "Male" : "Female"} · {c.language === "hi" ? "Hindi" : c.language === "hinglish" ? "Hinglish" : "English"}</td>
                  <td className="small">{CALL[c.status] || c.status}{c.outcome ? <div className="tiny faint">{c.outcome}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
