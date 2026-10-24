"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readTender } from "../../readActions";
import { generateBidPack } from "../../bidActions";
import { answerQuestion } from "../../questionActions";
import { confirmBrief } from "../../docActions";
import { answerMaster, answerFact, addWork, addPerson, setPersonField, chooseFormats, fillCustom } from "../../masterActions";
import DocFetch from "./DocFetch";
import CostPlanner from "./CostPlanner";
import { MasterAnswer, WorkAnswer, PersonAnswer, FormatPicker } from "./Questions";
import AnnexureEditor from "./AnnexureEditor";
import EvalPanel from "./EvalPanel";
import { Spinner, TimedProgress } from "@/components/Progress";
import { forceFiling, techMarking, askAssistant, saveAnnexure, annexureSegments } from "../../assistantActions";

const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

// Chat for one tender: the assistant's earlier messages (what is done), then one question at a time.
// Answers are saved to the Vault by server actions; the page re-loads its steps after each one.
export default function Assistant({ matchId, tenderId, done, steps, brief, formats, redo, canAnswer, canPrepare }) {
  const router = useRouter();
  const [log, setLog] = useState([]);
  const [skipped, setSkipped] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [working, setWorking] = useState(null); // { label, seconds } of what is running, for the progress bar
  const [text, setText] = useState("");
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [editing, setEditing] = useState(null); // { idx, title, segments } — an annexure opened again from "Your formats"
  const [forceNote, setForceNote] = useState("");
  const end = useRef(null);
  const current = steps.find((s) => !skipped.has(s.id));
  const waiting = steps.filter((s) => skipped.has(s.id));

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log.length, current?.id]);
  // documents present but not read yet: read them straight away (AI when available, else the free reader)
  const autoRead = useRef(false);
  useEffect(() => {
    if (current?.kind !== "read" || !current.auto || autoRead.current || !canAnswer) return;
    autoRead.current = true;
    run(null, () => readTender({}, form({ match_id: matchId, mode: current.aiReady ? "ai" : "basic" })), (r) => r.message, { label: "Reading every page of the tender…", seconds: current.aiReady ? 60 : 15 });
  }, [current?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = (who, msg, extra) => setLog((l) => [...l, { who, text: msg, ...extra }]);
  // roughly how long the slow steps take, for a progress bar instead of a bare spinner
  async function run(mine, fn, ok, eta) {
    if (mine) say("me", mine);
    else if (mine === null) say("bot", "Reading the documents…");
    setBusy(true);
    setWorking(eta || { label: "Working…" });
    try {
      const r = await fn();
      if (r?.error) say("bot", r.error, { error: true });
      else { say("bot", typeof ok === "function" ? ok(r) : ok, r?.url ? { url: r.url } : undefined); setText(""); }
    } catch (e) { say("bot", `Something went wrong: ${e.message}`, { error: true }); }
    setBusy(false);
    setWorking(null);
    router.refresh();
  }
  // ask anything, at any point: about the tender, or about the question on screen (Claude, from the documents)
  async function askNow(e) {
    e.preventDefault();
    const q = ask.trim();
    if (!q || asking) return;
    say("me", q);
    setAsk(""); setAsking(true);
    try {
      const r = await askAssistant({ matchId, question: q, about: current?.say || "", history: log.slice(-6) });
      say("bot", r.error || r.answer, r.error ? { error: true } : undefined);
    } catch (err) { say("bot", `Something went wrong: ${err.message}`, { error: true }); }
    setAsking(false);
  }
  async function openFormat(idx) {
    const r = await annexureSegments({ matchId, idx });
    if (r.error) say("bot", r.error, { error: true }); else setEditing({ idx, ...r });
  }
  const skip = () => { say("me", "Skip for now"); say("bot", "Okay, I'll ask that again later."); setSkipped((s) => new Set(s).add(current.id)); setText(""); };

  return (
    <div className="panel" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: "60vh" }}>
      <div style={{ flex: 1, padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 10 }} aria-live="polite">
        <Bubble>Namaste! I'll prepare this tender with you. I'll ask only what I can't find in your Vault, and save every answer so the next tender asks less.</Bubble>
        {done.map((d, i) => <Bubble key={`d${i}`}>{d}</Bubble>)}
        {redo && (redo.read || redo.tech) && (
          <div className="row" style={{ gap: 8, alignSelf: "flex-start" }}>
            {redo.read && <button className="ghost sm" aria-busy={busy} disabled={busy} onClick={() => run("Read the tender again with AI", () => readTender({}, form({ match_id: matchId, mode: "ai" })), (r) => r.message, { label: "AI is reading the tender again…", seconds: 60 })}>↻ Read again with AI · 99 credits</button>}
            {redo.tech && <button className="ghost sm" aria-busy={busy} disabled={busy} onClick={() => run("Redo the technical marking", () => techMarking({ matchId }), (r) => r.message, { label: "Reading the evaluation criteria and marking your firm again…", seconds: 50 })}>↻ Redo technical marking · 29 credits</button>}
          </div>
        )}
        {log.map((x, i) => (
          <Bubble key={`l${i}`} me={x.who === "me"} error={x.error}>
            {x.text}{x.url && <> <a href={x.url} target="_blank" rel="noreferrer">Download PDF</a></>}
          </Bubble>
        ))}
        {formats?.length > 0 && (
          <details style={{ alignSelf: "stretch" }}>
            <summary className="small" style={{ cursor: "pointer" }}>Your formats ({formats.length}) — {formats.filter((f) => /^Ready/.test(f.status)).length} ready</summary>
            <div className="stack-sm" style={{ marginTop: 8 }}>
              {formats.map((f, i) => (
                <details key={i} className="panel" style={{ padding: "8px 12px" }}>
                  <summary className="small" style={{ cursor: f.text ? "pointer" : "default" }}><strong>{f.title}</strong> <span className={`chip ${/^Ready/.test(f.status) ? "ok" : /blank|Waiting/.test(f.status) ? "warn" : "mute"}`}>{f.status}</span></summary>
                  {f.text && <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, margin: "8px 0 0" }}>{f.text}</pre>}
                  {f.editable && f.idx != null && <button className="ghost sm" style={{ marginTop: 8 }} onClick={() => openFormat(f.idx)}>Open as a form</button>}
                </details>
              ))}
            </div>
          </details>
        )}
        {editing && (
          <AnnexureEditor key={`e${editing.idx}`} title={editing.title} segments={editing.segments} busy={busy} onCancel={() => setEditing(null)}
            onSave={(segs) => run(`Saved “${editing.title}”`, () => saveAnnexure({ matchId, idx: editing.idx, segments: segs }), (r) => { setEditing(null); return r.message; })} />
        )}
        {brief && current?.kind !== "brief" && (
          <details style={{ alignSelf: "stretch" }}><summary className="small" style={{ cursor: "pointer" }}>Tender brief</summary><div style={{ marginTop: 8 }}>{brief}</div></details>
        )}
        {current?.kind === "brief" && brief}
        {current ? (
          <Bubble>
            {current.kind === "mandatory" && (
              <div className="stack-sm">
                <div><strong>{current.say}</strong></div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>{current.unmet.map((u, i) => <li key={i}>{u}</li>)}</ul>
                <div className="tiny faint">If your Vault is out of date, say you meet it (yes/no conditions are corrected here; turnover, works and documents in the Vault). Or file anyway — I'll record that you chose to.</div>
              </div>
            )}
            {current.kind === "fetch" ? <DocFetch matchId={matchId} tenderId={tenderId} step={current} say={current.say} canAnswer={canAnswer} /> : current.kind === "mandatory" ? null : <div>{current.say}</div>}
            {current.quote && <div className="tiny faint" style={{ marginTop: 6 }}>Tender says{current.page ? ` (p. ${current.page})` : ""}: “{current.quote}”</div>}
          </Bubble>
        ) : (
          <Bubble>{waiting.length ? `That's all for now. You skipped ${waiting.length} question${waiting.length === 1 ? "" : "s"}; open this page again to answer ${waiting.length === 1 ? "it" : "them"}.` : "All done for this tender. Download the pack from the tender page, check it, and sign it when ready."}</Bubble>
        )}
        <div ref={end} />
      </div>

      {(working || asking) && (
        <div style={{ borderTop: "1px solid var(--line)", padding: "10px 14px" }} aria-live="polite">
          {asking ? <TimedProgress key="ask" seconds={20} label="Looking through the tender for your answer…" /> : working?.seconds ? <TimedProgress key={working.label} seconds={working.seconds} label={working.label} /> : <Spinner label={working?.label || "Working…"} />}
        </div>
      )}
      {current && canAnswer && current.kind !== "fetch" && (
        <div style={{ borderTop: "1px solid var(--line)", padding: 14, background: "var(--paper-2, transparent)" }} className="stack-sm">
          {current.kind === "yes_no" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Yes", () => answerQuestion({ key: current.key, value: "yes", label: current.label, matchId }), "Noted and saved to your Vault. Every tender that asks this now counts it as met.")}>Yes</button>
              <button className="ghost" disabled={busy} onClick={() => run("No", () => answerQuestion({ key: current.key, value: "no", label: current.label, matchId }), "Noted. Tenders that require this will show a warning, and you decide whether to file; you can change the answer in Vault → Facts any time.")}>No</button>
              <button className="ghost" disabled={busy} onClick={skip}>Skip</button>
            </div>
          )}
          {current.kind === "master" && <MasterAnswer key={current.id} step={current} busy={busy} skip={skip} send={(mine, v) => run(mine, () => answerMaster({ field: current.field, value: v, matchId }), "Saved to your masters — I won't ask again.")} />}
          {current.kind === "fact" && <MasterAnswer key={current.id} step={current} busy={busy} skip={skip} send={(mine, v) => run(current.type === "money" ? `₹${Number(v).toLocaleString("en-IN")}` : mine, () => answerFact({ key: current.key, period: current.period || "", value: v, unit: current.unit || null, money: current.type === "money", matchId }), "Saved to your masters — every tender that needs it will use it.")} />}
          {current.kind === "person_field" && <MasterAnswer key={current.id} step={current} busy={busy} skip={skip} send={(mine, v) => run(mine, () => setPersonField({ personId: current.personId, field: current.field, value: v, matchId }), "Saved in Key people — every tender that needs it will use it.")} />}
          {current.kind === "mandatory" && (
            <div className="stack-sm">
              <div className="row" style={{ gap: 8 }}>
                {current.conds.length > 0 && <button disabled={busy || !canPrepare} onClick={() => run("We do meet these conditions", async () => { for (const c of current.conds) { const r = await answerQuestion({ key: c.key, value: "yes", label: c.label, matchId }); if (r?.error) return r; } return { ok: true }; }, "Noted and saved to your Vault — the tender is re-scored.")}>We do meet {current.conds.length === 1 ? "it" : "them"}</button>}
                <Link className="btn ghost" href="/app/vault">Update my Vault</Link>
                <button className="ghost" disabled={busy || !canPrepare} onClick={() => run("Not for us", () => confirmBrief({ matchId, go: false }), "Okay, moved to Skipped. You can restore it from the Tenders page.")}>Not for us</button>
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input value={forceNote} onChange={(e) => setForceNote(e.target.value)} placeholder="Why file anyway? (optional, e.g. JV partner meets it)" aria-label="Reason for filing anyway" style={{ flex: 1, width: "auto" }} />
                <button className="danger" disabled={busy || !canPrepare} onClick={() => run("File anyway — I accept the risk", () => forceFiling({ matchId, note: forceNote }), "Recorded. I'll carry on preparing the bid; the warning stays on the preparation sheet.")}>File anyway</button>
              </div>
            </div>
          )}
          {current.kind === "annexure" && (
            <AnnexureEditor key={current.id} title={current.title} segments={current.segments} busy={busy}
              onSave={(segs) => run(`Saved “${current.title}”`, () => saveAnnexure({ matchId, idx: current.idx, segments: segs }), (r) => r.message)} />
          )}
          {current.kind === "tech_eval" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy || !current.paidAi} title={current.paidAi ? "" : "Needs a paid AI key"} onClick={() => run("Yes, work out the technical marks", () => techMarking({ matchId }), (r) => r.message, { label: "Reading the evaluation criteria and marking your firm…", seconds: 50 })}>{busy ? "Reading the evaluation…" : "Work it out · 29 credits"}</button>
              <button className="ghost" disabled={busy} onClick={skip}>Not now</button>
            </div>
          )}
          {current.kind === "work" && <WorkAnswer busy={busy} skip={skip} send={(mine, w) => run(mine, () => addWork({ ...w, matchId }), "Saved to your works. I'll list it in every similar-works format.")} />}
          {current.kind === "person" && <PersonAnswer busy={busy} skip={skip} send={(mine, p) => run(mine, () => addPerson({ ...p, matchId }), "Saved to your key people.")} />}
          {current.kind === "choose_formats" && <FormatPicker step={current} busy={busy || !canPrepare} send={(mine, list) => run(mine, () => chooseFormats({ matchId, choices: list }), "Done. Now only what these formats need and your masters don't have yet.")} />}
          {current.kind === "brief" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy || !canPrepare} onClick={() => run("Looks good — let's prepare the bid", () => confirmBrief({ matchId, go: true }), "Great. I'll go through what I need from you, one thing at a time.")}>Looks good — start preparing</button>
              <button className="ghost" disabled={busy || !canPrepare} onClick={() => run("Not for us", () => confirmBrief({ matchId, go: false }), "Okay, I've moved it to Skipped. You can restore it from the Tenders page.")}>Not for us</button>
            </div>
          )}
          {current.kind === "read" && (
            <div className="row" style={{ gap: 8 }}>
              <button className="ghost" disabled={busy} onClick={() => run("Read it with the free reader", () => readTender({}, form({ match_id: matchId, mode: "basic" })), (r) => r.message, { label: "Reading the tender (free reader)…", seconds: 15 })}>{busy ? "Reading…" : "Free reader · 10 credits"}</button>
              <button disabled={busy} onClick={() => run("Read it with AI", () => readTender({}, form({ match_id: matchId, mode: "ai" })), (r) => r.message, { label: "AI is reading the tender…", seconds: 60 })}>{busy ? "Reading…" : "Read with AI · 99 credits"}</button>
            </div>
          )}
          {current.kind === "fill_ai" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Yes, fill them with AI", () => fillCustom({ matchId }), (r) => r.message, { label: "Filling the formats from your masters…", seconds: 45 })}>{busy ? "Filling…" : "Fill with AI · 49 credits"}</button>
              <button className="ghost" disabled={busy} onClick={skip}>Not now</button>
            </div>
          )}
          {current.kind === "price" && current.ev && <EvalPanel ev={current.ev} estimate={current.estimate} cost={current.cost} quote={current.quote} />}
          {current.kind === "price" && <CostPlanner matchId={matchId} initial={current.sheet} estimate={current.estimate} fresh={current.fresh} onDone={(label) => { say("me", label); say("bot", "Price saved for this tender. It goes on the preparation sheet; you enter it in the portal's price bid."); router.refresh(); }} />}
          {current.kind === "draft" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Make the draft", () => generateBidPack({}, form({ match_id: matchId, kind: "draft" })), (r) => r.message || "Draft ready.", { label: "Putting the bid file together…", seconds: 20 })}>{busy ? "Preparing…" : "Make draft bid pack"}</button>
              <Link className="btn ghost" href={`/app/tenders/${matchId}`}>Open the tender page</Link>
            </div>
          )}
        </div>
      )}
      {canAnswer && (
        <form onSubmit={askNow} className="row" style={{ gap: 8, flexWrap: "nowrap", borderTop: "1px solid var(--line)", padding: "10px 14px" }}>
          <input value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Ask anything about this tender or this question…" aria-label="Ask the assistant" style={{ flex: 1, width: "auto" }} />
          <button aria-busy={!!asking} className="ghost" disabled={asking || !ask.trim()}>{asking ? "Thinking…" : "Ask · 3 credits"}</button>
        </form>
      )}
    </div>
  );
}

function Bubble({ me, error, children }) {
  return (
    <div style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "85%", padding: "10px 14px", borderRadius: me ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
      background: me ? "var(--primary)" : error ? "var(--blood-soft)" : "var(--line-soft)", color: me ? "#fff" : error ? "var(--blood)" : "inherit", fontSize: 14, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}
