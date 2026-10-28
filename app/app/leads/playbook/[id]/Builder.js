"use client";
import { useState, useTransition } from "react";
import { STEP_TYPES, LANGUAGES, VOICES, DAYS, UNITS, PLACEHOLDERS, delayMinutes, delayText } from "@/lib/playbook";
import { savePlaybook } from "../actions";

const blank = (type) => ({ type, amount: 1, unit: type === "ai_call" ? "minutes" : "days", script: "", goal: "", language: "en", voice: "female", match_language: true,
  wa_template: "", wa_lang: "en", subject: "", body: "", send_via: "whatsapp", type_id: "", title: "", details: "" });

export default function Builder({ id, initial, canEdit, sources, meetingTypes, channels }) {
  const [pb, setPb] = useState(initial);
  const [note, setNote] = useState(null);
  const [pending, start] = useTransition();
  const set = (k, v) => setPb((p) => ({ ...p, [k]: v }));
  const setStep = (i, k, v) => setPb((p) => ({ ...p, steps: p.steps.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const move = (i, d) => setPb((p) => { const s = [...p.steps]; const j = i + d; if (j < 0 || j >= s.length) return p; [s[i], s[j]] = [s[j], s[i]]; return { ...p, steps: s }; });
  const remove = (i) => setPb((p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }));
  const add = (type) => setPb((p) => ({ ...p, steps: [...p.steps, blank(type)] }));
  const toggle = (k, v) => setPb((p) => ({ ...p, [k]: p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v] }));
  const save = () => start(async () => { setNote(null); const r = await savePlaybook(id, pb); setNote(r.error ? { bad: r.error } : { ok: "Saved." }); });

  // when each step happens, counted from the moment the lead arrives (before office hours move it)
  let clock = 0;
  const when = pb.steps.map((s) => (clock += delayMinutes(s.amount, s.unit)));
  const total = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 6) / 10} h` : `day ${Math.round((m / 1440) * 10) / 10}`);

  return (
    <fieldset disabled={!canEdit || pending} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
      <div className="panel">
        <div className="grid-2">
          <label>Playbook name<input value={pb.name} onChange={(e) => set("name", e.target.value)} maxLength={120} /></label>
          <label>Status
            <select value={pb.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}><option value="1">On — runs</option><option value="0">Off — paused</option></select>
          </label>
        </div>
        <label>Starts
          <select value={pb.trigger} onChange={(e) => set("trigger", e.target.value)}>
            <option value="new_lead">Automatically, the moment a new lead arrives</option>
            <option value="manual">Only when we start it for chosen leads</option>
          </select>
        </label>
        {pb.trigger === "new_lead" && (
          <div>
            <div className="small muted">For leads from (none ticked = every source)</div>
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              {Object.entries(sources).map(([k, label]) => (
                <label key={k} className="chip" style={{ cursor: "pointer", fontWeight: 500 }}>
                  <input type="checkbox" checked={pb.trigger_sources.includes(k)} onChange={() => toggle("trigger_sources", k)} style={{ width: "auto", marginRight: 6 }} />{label}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid-3" style={{ marginTop: 12 }}>
          <label>Office opens<input type="time" value={pb.office_from} onChange={(e) => set("office_from", e.target.value)} /></label>
          <label>Office closes<input type="time" value={pb.office_to} onChange={(e) => set("office_to", e.target.value)} /></label>
          <div>
            <div className="small muted">Working days</div>
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              {DAYS.map(([n, l]) => (
                <button type="button" key={n} className={pb.office_days.includes(n) ? "sm" : "ghost sm"} onClick={() => toggle("office_days", n)}>{l}</button>
              ))}
            </div>
          </div>
        </div>
        <p className="tiny faint" style={{ margin: "8px 0 0" }}>Calls and messages go out only between these hours on these days (India time); anything due outside waits for the next opening.</p>
      </div>

      {pb.steps.map((s, i) => {
        const T = STEP_TYPES[s.type];
        return (
          <div className="panel" key={i}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{T.icon} Step {i + 1} · {T.label}</h3>
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="ghost sm" onClick={() => move(i, -1)} disabled={i === 0} title="Move up">↑</button>
                <button type="button" className="ghost sm" onClick={() => move(i, 1)} disabled={i === pb.steps.length - 1} title="Move down">↓</button>
                <button type="button" className="ghost sm" onClick={() => remove(i)} title="Remove this step">Remove</button>
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <span className="small">Wait</span>
              <input type="number" min={0} max={999} value={s.amount} onChange={(e) => setStep(i, "amount", e.target.value)} style={{ width: 80 }} />
              <select value={s.unit} onChange={(e) => setStep(i, "unit", e.target.value)} style={{ width: "auto" }}>
                {Object.keys(UNITS).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <span className="small muted">{i === 0 ? "after the lead arrives" : "after the step before"} · runs {delayText(delayMinutes(s.amount, s.unit))} (about {total(when[i])} from arrival)</span>
            </div>

            {s.type === "ai_call" && (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {!channels.ai && <div className="notice">AI calling is not connected yet. Until it is, this step becomes a call task for the lead's owner with this same script, so no lead is missed.</div>}
                <div className="grid-3">
                  <label>Voice<select value={s.voice} onChange={(e) => setStep(i, "voice", e.target.value)}>{Object.entries(VOICES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label>Starts in<select value={s.language} onChange={(e) => setStep(i, "language", e.target.value)}>{Object.entries(LANGUAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                  <label className="row" style={{ gap: 8, alignSelf: "end" }}><input type="checkbox" checked={s.match_language} onChange={(e) => setStep(i, "match_language", e.target.checked)} style={{ width: "auto" }} />Reply in the language the client speaks</label>
                </div>
                <label>Goal of the call<input value={s.goal} onChange={(e) => setStep(i, "goal", e.target.value)} maxLength={300} placeholder="e.g. Find out if they need an audit this year and offer a 15-minute meeting" /></label>
                <label>Script — how the caller opens and what it must cover<textarea rows={5} value={s.script} onChange={(e) => setStep(i, "script", e.target.value)} maxLength={4000} /></label>
              </div>
            )}

            {(s.type === "whatsapp" || (s.type === "booking_link" && s.send_via === "whatsapp")) && (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {s.type === "booking_link" && <BookingFields s={s} i={i} setStep={setStep} meetingTypes={meetingTypes} />}
                {!channels.whatsapp && <div className="notice">WhatsApp is not connected yet (Outreach → Sender settings). Until then this step is skipped and the playbook moves on.</div>}
                <div className="grid-2">
                  <label>Approved template name<input value={s.wa_template} onChange={(e) => setStep(i, "wa_template", e.target.value.toLowerCase())} placeholder="e.g. intro_message" /></label>
                  <label>Template language<input value={s.wa_lang} onChange={(e) => setStep(i, "wa_lang", e.target.value)} placeholder="en / hi" /></label>
                </div>
                <p className="tiny faint" style={{ margin: 0 }}>The template is filled with {"{{1}}"} = the client's first name, {"{{2}}"} = your company{s.type === "booking_link" ? <>, {"{{3}}"} = the booking link</> : null}. Only leads who agreed to WhatsApp get it.</p>
              </div>
            )}

            {(s.type === "email" || (s.type === "booking_link" && s.send_via === "email")) && (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                {s.type === "booking_link" && <BookingFields s={s} i={i} setStep={setStep} meetingTypes={meetingTypes} />}
                {!channels.email && <div className="notice">Email sending is not switched on yet. Until it is, this step is skipped and the playbook moves on.</div>}
                <label>Subject<input value={s.subject} onChange={(e) => setStep(i, "subject", e.target.value)} maxLength={200} placeholder={s.type === "booking_link" ? "Pick a time to talk — {our_company}" : ""} /></label>
                <label>Message<textarea rows={5} value={s.body} onChange={(e) => setStep(i, "body", e.target.value)} maxLength={5000}
                  placeholder={s.type === "booking_link" ? "Dear {name},\n\nPlease pick a time that suits you: {booking_link}\n\nRegards" : ""} /></label>
              </div>
            )}

            {s.type === "task" && (
              <div className="stack" style={{ gap: 10, marginTop: 10 }}>
                <label>What should the lead's owner do?<input value={s.title} onChange={(e) => setStep(i, "title", e.target.value)} maxLength={200} placeholder="e.g. Call {name} and send the quote" /></label>
                <label>Notes for them<textarea rows={3} value={s.details} onChange={(e) => setStep(i, "details", e.target.value)} maxLength={2000} /></label>
              </div>
            )}
            <p className="tiny faint" style={{ margin: "8px 0 0" }}>{T.hint} You can use {PLACEHOLDERS}{s.type !== "ai_call" && s.type !== "task" ? " {booking_link}" : ""} in the text.</p>
          </div>
        );
      })}

      {canEdit && (
        <div className="panel">
          <div className="small muted" style={{ marginBottom: 8 }}>Add a step</div>
          <div className="row" style={{ gap: 6 }}>
            {Object.entries(STEP_TYPES).map(([k, t]) => <button type="button" key={k} className="ghost sm" onClick={() => add(k)}>{t.icon} {t.label}</button>)}
          </div>
        </div>
      )}

      {canEdit && (
        <div className="row" style={{ position: "sticky", bottom: 12, gap: 12 }}>
          <button type="button" onClick={save} aria-busy={pending}>Save playbook</button>
          {note?.ok && <span className="small" style={{ color: "var(--ok)" }}>{note.ok}</span>}
          {note?.bad && <span className="small" style={{ color: "var(--bad)" }}>{note.bad}</span>}
        </div>
      )}
    </fieldset>
  );
}

function BookingFields({ s, i, setStep, meetingTypes }) {
  return (
    <div className="grid-2">
      <label>Meeting type
        <select value={s.type_id} onChange={(e) => setStep(i, "type_id", e.target.value)}>
          <option value="">First online meeting type</option>
          {meetingTypes.filter((t) => t.mode === "online").map((t) => <option key={t.id} value={t.id}>{t.name} · {t.duration_min} min</option>)}
        </select>
      </label>
      <label>Send the link by
        <select value={s.send_via} onChange={(e) => setStep(i, "send_via", e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select>
      </label>
    </div>
  );
}
