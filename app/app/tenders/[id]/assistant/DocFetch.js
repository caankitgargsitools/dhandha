"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/Progress";
import { UploadTenderFiles } from "../../TenderDocs";
import { fetchDocs, answerDocCaptcha, collectDocs, cancelDocJob } from "../../docActions";
import { readTender } from "../../readActions";

const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };

// Step 1 of the assistant: the crawler fetches the documents from the portal while this shows what it is doing.
// A captcha on the portal goes to Dhandha's platform admins (captcha desk + phone notification); only they see the
// picture here. Customers just see the fetch progressing. When the files arrive they are stored and read.
// A finished fetch that brought no PDF ("collected") asks for an upload instead of fetching again on every visit.
export default function DocFetch({ matchId, tenderId, step, say, canAnswer }) {
  const router = useRouter();
  const [job, setJob] = useState(step.job);
  const [note, setNote] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(""); // "storing" | "reading"
  const started = useRef(false);
  const handled = useRef(false);
  const supabase = useRef(null);

  // start a fetch as soon as the assistant opens (once)
  useEffect(() => {
    if (started.current || job || !canAnswer) return;
    started.current = true;
    fetchDocs({ matchId }).then((r) => {
      if (r.error) { setNote(r.error); return; }
      // the always-on fetcher on GitHub picks the job up within seconds; nothing to start from here
      setJob({ id: r.jobId, status: "queued", step: "Waiting for the crawler to start" });
    }, (e) => setNote(`Could not start the fetch: ${e.message}`));
  }, [job, matchId, canAnswer]);

  // follow the job (stops once it has finished, failed or was stopped)
  useEffect(() => {
    if (!job?.id || ["collected", "cancelled", "failed"].includes(job.status)) return;
    supabase.current ||= createClient();
    const tick = async () => {
      const { data } = await supabase.current.from("tender_doc_jobs").select("id, status, step, captcha_image, captcha_seq, error, files").eq("id", job.id).single();
      if (data) setJob(data);
    };
    tick();
    const t = setInterval(tick, 2500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  // files arrived: store them, then read them (reading uses credits: admins, managers and bid preparers only)
  useEffect(() => {
    if (job?.status !== "fetched" || handled.current) return;
    handled.current = true;
    (async () => {
      try {
        setPhase("storing");
        const c = await collectDocs({ jobId: job.id });
        if (c.error) { setNote(c.error); return; }
        if (!step.canRead) { setNote("The documents are saved. An admin, manager or bid preparer can now read them (it uses credits)."); router.refresh(); return; }
        setPhase("reading");
        const r = await readTender({}, form({ match_id: matchId, mode: step.aiReady ? "ai" : "basic" }));
        setNote(r.error ? `Fetched, but reading failed: ${r.error}` : r.message);
        router.refresh();
      } catch (e) {
        setNote(`Something went wrong: ${e.message}`);
      } finally {
        setPhase("");
      }
    })();
  }, [job?.status, job?.id, matchId, step.aiReady, step.canRead, router]);

  async function sendCaptcha(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await answerDocCaptcha({ jobId: job.id, answer });
      if (r.error) setNote(r.error); else { setAnswer(""); setNote(""); setJob({ ...job, status: "running", step: "Captcha sent to the portal" }); }
    } catch (err) { setNote(`Something went wrong: ${err.message}`); } finally { setBusy(false); }
  }
  async function retry() {
    handled.current = false; started.current = true;
    setNote("");
    setBusy(true);
    try {
      const r = await fetchDocs({ matchId });
      if (r.error) setNote(r.error); else setJob({ id: r.jobId, status: "queued", step: "Waiting for the crawler to start" });
    } catch (err) { setNote(`Something went wrong: ${err.message}`); } finally { setBusy(false); }
  }
  async function stop() {
    setBusy(true);
    try {
      const r = await cancelDocJob({ jobId: job.id });
      if (r.error) setNote(r.error); else setJob({ ...job, status: "cancelled", step: "Stopped" });
    } catch (err) { setNote(`Something went wrong: ${err.message}`); } finally { setBusy(false); }
  }

  const active = job && ["queued", "running", "captcha"].includes(job.status);
  const working = (job && ["queued", "running"].includes(job.status)) || (job?.status === "captcha" && !step.typer) || phase;
  const ended = job && ["failed", "collected", "cancelled"].includes(job.status);
  return (
    <div className="stack-sm">
      <div>{say}</div>
      {job && job.status !== "collected" && (
        <div className="row small" style={{ gap: 8, alignItems: "center" }}>
          {working && <Spinner size={12} />}
          <span>{phase === "storing" ? "Saving the documents…" : phase === "reading" ? "Reading every page and preparing the brief…" : job.status === "failed" ? "" : job.status === "captcha" && !step.typer ? "Fetching from the portal — a few more minutes" : job.step}</span>
          {active && canAnswer && !phase && <button className="ghost sm" aria-busy={busy} disabled={busy} onClick={stop}>Stop</button>}
        </div>
      )}
      {job?.status === "captcha" && job.captcha_image && canAnswer && step.typer && (
        <form onSubmit={sendCaptcha} className="stack-sm" style={{ background: "var(--panel)", border: "1px solid var(--marigold)", borderRadius: 10, padding: 10, maxWidth: 360 }}>
          <strong className="small">The portal asks for a captcha</strong>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.captcha_image} alt="Captcha from the portal" style={{ maxWidth: "100%", imageRendering: "pixelated", minHeight: 40, background: "var(--panel)" }} />
          <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} autoFocus autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="Type what you see" aria-label="Captcha text" style={{ flex: 1, width: "auto" }} />
            <button aria-busy={busy} disabled={busy || !answer.trim()}>Send</button>
          </div>
        </form>
      )}
      {job?.status === "failed" && <div className="small" style={{ color: "var(--blood)" }}>{job.error || "Fetching failed."}</div>}
      {note && <div className="small muted">{note}</div>}
      {(ended || (note && !active)) && canAnswer && !phase && (
        <div className="stack-sm">
          <div className="row" style={{ gap: 8 }}>
            <button className="sm" aria-busy={busy} disabled={busy} onClick={retry}>Try fetching again</button>
          </div>
          <div className="tiny faint">Or upload the PDFs yourself:</div>
          <UploadTenderFiles tenderId={tenderId} />
        </div>
      )}
    </div>
  );
}
