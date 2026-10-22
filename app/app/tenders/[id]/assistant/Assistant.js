"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readTender } from "../../readActions";
import { generateBidPack } from "../../bidActions";
import { answerQuestion } from "../../questionActions";
import { confirmBrief } from "../../docActions";
import { answerMaster, answerFact, addWork, addPerson, chooseFormats, fillCustom } from "../../masterActions";
import DocFetch from "./DocFetch";
import CostPlanner from "./CostPlanner";
import { MasterAnswer, WorkAnswer, PersonAnswer, FormatPicker } from "./Questions";

const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

// Chat for one tender: the assistant's earlier messages (what is done), then one question at a time.
// Answers are saved to the Vault by server actions; the page re-loads its steps after each one.
export default function Assistant({ matchId, tenderId, done, steps, brief, canAnswer, canPrepare }) {
  const router = useRouter();
  const [log, setLog] = useState([]);
  const [skipped, setSkipped] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const end = useRef(null);
  const current = steps.find((s) => !skipped.has(s.id));
  const waiting = steps.filter((s) => skipped.has(s.id));

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [log.length, current?.id]);
  // documents present but not read yet: read them straight away (AI when available, else the free reader)
  const autoRead = useRef(false);
  useEffect(() => {
    if (current?.kind !== "read" || !current.auto || autoRead.current || !canAnswer) return;
    autoRead.current = true;
    run(null, () => readTender({}, form({ match_id: matchId, mode: current.aiReady ? "ai" : "basic" })), (r) => r.message);
  }, [current?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const say = (who, msg, extra) => setLog((l) => [...l, { who, text: msg, ...extra }]);
  async function run(mine, fn, ok) {
    if (mine) say("me", mine);
    else if (mine === null) say("bot", "Reading the documents…");
    setBusy(true);
    try {
      const r = await fn();
      if (r?.error) say("bot", r.error, { error: true });
      else { say("bot", typeof ok === "function" ? ok(r) : ok, r?.url ? { url: r.url } : undefined); setText(""); }
    } catch (e) { say("bot", `Something went wrong: ${e.message}`, { error: true }); }
    setBusy(false);
    router.refresh();
  }
  const skip = () => { say("me", "Skip for now"); say("bot", "Okay, I'll ask that again later."); setSkipped((s) => new Set(s).add(current.id)); setText(""); };

  return (
    <div className="panel" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: "60vh" }}>
      <div style={{ flex: 1, padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 10 }} aria-live="polite">
        <Bubble>Namaste! I'll prepare this tender with you. I'll ask only what I can't find in your Vault, and save every answer so the next tender asks less.</Bubble>
        {done.map((d, i) => <Bubble key={`d${i}`}>{d}</Bubble>)}
        {log.map((x, i) => (
          <Bubble key={`l${i}`} me={x.who === "me"} error={x.error}>
            {x.text}{x.url && <> <a href={x.url} target="_blank" rel="noreferrer">Download PDF</a></>}
          </Bubble>
        ))}
        {brief && current?.kind !== "brief" && (
          <details style={{ alignSelf: "stretch" }}><summary className="small" style={{ cursor: "pointer" }}>Tender brief</summary><div style={{ marginTop: 8 }}>{brief}</div></details>
        )}
        {current?.kind === "brief" && brief}
        {current ? (
          <Bubble>
            {current.kind === "fetch" ? <DocFetch matchId={matchId} tenderId={tenderId} step={current} say={current.say} canAnswer={canAnswer} /> : <div>{current.say}</div>}
            {current.quote && <div className="tiny faint" style={{ marginTop: 6 }}>Tender says{current.page ? ` (p. ${current.page})` : ""}: “{current.quote}”</div>}
          </Bubble>
        ) : (
          <Bubble>{waiting.length ? `That's all for now. You skipped ${waiting.length} question${waiting.length === 1 ? "" : "s"}; open this page again to answer ${waiting.length === 1 ? "it" : "them"}.` : "All done for this tender. Download the pack from the tender page, check it, and sign it when ready."}</Bubble>
        )}
        <div ref={end} />
      </div>

      {current && canAnswer && current.kind !== "fetch" && (
        <div style={{ borderTop: "1px solid var(--line)", padding: 14, background: "var(--paper-2, transparent)" }} className="stack-sm">
          {current.kind === "yes_no" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Yes", () => answerQuestion({ key: current.key, value: "yes", label: current.label, matchId }), "Noted and saved to your Vault. Every tender that asks this now counts it as met.")}>Yes</button>
              <button className="ghost" disabled={busy} onClick={() => run("No", () => answerQuestion({ key: current.key, value: "no", label: current.label, matchId }), "Noted. Tenders that require this will show as not eligible; you can change the answer in Vault → Facts any time.")}>No</button>
              <button className="ghost" disabled={busy} onClick={skip}>Skip</button>
            </div>
          )}
          {current.kind === "master" && <MasterAnswer key={current.id} step={current} busy={busy} skip={skip} send={(mine, v) => run(mine, () => answerMaster({ field: current.field, value: v, matchId }), "Saved to your masters — I won't ask again.")} />}
          {current.kind === "fact" && <MasterAnswer key={current.id} step={current} busy={busy} skip={skip} send={(mine, v) => run(current.type === "money" ? `₹${Number(v).toLocaleString("en-IN")}` : mine, () => answerFact({ key: current.key, period: current.period || "", value: v, unit: current.unit || null, money: current.type === "money", matchId }), "Saved to your masters — every tender that needs it will use it.")} />}
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
              <button className="ghost" disabled={busy} onClick={() => run("Read it with the free reader", () => readTender({}, form({ match_id: matchId, mode: "basic" })), (r) => r.message)}>{busy ? "Reading…" : "Free reader · 10 credits"}</button>
              <button disabled={busy} onClick={() => run("Read it with AI", () => readTender({}, form({ match_id: matchId, mode: "ai" })), (r) => r.message)}>{busy ? "Reading…" : "Read with AI · 99 credits"}</button>
            </div>
          )}
          {current.kind === "fill_ai" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Yes, fill them with AI", () => fillCustom({ matchId }), (r) => r.message)}>{busy ? "Filling…" : "Fill with AI · 49 credits"}</button>
              <button className="ghost" disabled={busy} onClick={skip}>Not now</button>
            </div>
          )}
          {current.kind === "price" && <CostPlanner matchId={matchId} initial={current.sheet} estimate={current.estimate} fresh={current.fresh} onDone={(label) => { say("me", label); say("bot", "Price saved for this tender. It goes on the preparation sheet; you enter it in the portal's price bid."); router.refresh(); }} />}
          {current.kind === "draft" && (
            <div className="row" style={{ gap: 8 }}>
              <button disabled={busy} onClick={() => run("Make the draft", () => generateBidPack({}, form({ match_id: matchId, kind: "draft" })), (r) => r.message || "Draft ready.")}>{busy ? "Preparing…" : "Make draft bid pack"}</button>
              <Link className="btn ghost" href={`/app/tenders/${matchId}`}>Open the tender page</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Bubble({ me, error, children }) {
  return (
    <div style={{ alignSelf: me ? "flex-end" : "flex-start", maxWidth: "85%", padding: "10px 14px", borderRadius: me ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
      background: me ? "var(--ink)" : error ? "rgba(140,29,47,.08)" : "var(--line-soft)", color: me ? "#fff" : error ? "var(--blood)" : "inherit", fontSize: 14, lineHeight: 1.45 }}>
      {children}
    </div>
  );
}
