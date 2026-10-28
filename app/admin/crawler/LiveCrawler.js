"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { expectedSeconds, remaining, fraction, queueEta, dur } from "@/lib/crawlerEta";

const CHIP = { done: ["ok", "Done"], failed: ["bad", "Failed"], skipped: ["mute", "Next run"], running: ["info", "Running"], queued: ["mute", "Queued"] };

// Live view of the crawler: what is running, how far it got, what is queued and when each should start.
export default function LiveCrawler({ runners, stats }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const live = runners.filter((r) => r.status === "running" && now - Date.parse(r.updated_at) < 10 * 60000);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), live.length ? 5000 : 30000);
    return () => { clearInterval(tick); clearInterval(refresh); };
  }, [router, live.length]);

  const r = live[0] || runners[0];
  if (!r) {
    return (
      <div className="panel">
        <div className="panel-head"><h3>Live crawler</h3></div>
        <p className="small muted" style={{ margin: 0 }}>No crawl has reported yet. The crawler on the AWS Mumbai server reports here when its next run starts.</p>
      </div>
    );
  }
  const s = r.state || {};
  const steps = s.steps || [];
  const isLive = live.includes(r);
  const running = steps.filter((x) => x.status === "running").map((x) => {
    const elapsed = (now - Date.parse(x.started_at)) / 1000;
    const expected = expectedSeconds(x.step, stats);
    return { ...x, elapsed, expected, left: remaining(x, elapsed, expected), pct: Math.round(fraction(x, elapsed, expected) * 100) };
  });
  const queued = queueEta(running, steps.filter((x) => x.status === "queued"), stats, s.concurrency || 2);
  const finished = steps.filter((x) => ["done", "failed", "skipped"].includes(x.status));
  const totalLeft = queued.length ? Math.max(...queued.map((q) => q.startsIn + q.expected)) : Math.max(0, ...running.map((x) => x.left));
  const doneCount = steps.filter((x) => x.status === "done").length;
  const pctAll = steps.length ? Math.round(((doneCount + running.reduce((t, x) => t + x.pct / 100, 0)) / steps.length) * 100) : 0;
  const bar = (pct, color = "var(--madder)") => (
    <div style={{ height: 8, borderRadius: 99, background: "var(--line-soft)", overflow: "hidden" }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .8s" }} />
    </div>
  );

  return (
    <div className="panel stack-sm">
      <div className="panel-head">
        <h3>Live crawler {isLive ? <span className="chip info" style={{ marginLeft: 6 }}>Running</span> : <span className={`chip ${r.status === "failed" ? "bad" : "ok"}`} style={{ marginLeft: 6 }}>{r.status === "failed" ? "Last run failed" : "Last run finished"}</span>}</h3>
        <span className="row" style={{ gap: 8 }}>
          {s.link && <a className="small" href={s.link} target="_blank" rel="noreferrer">Run log</a>}
        </span>
      </div>
      <div className="small faint">
        {s.where || r.runner} · started {new Date(s.started_at || r.started_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}
        {" · "}{doneCount} of {steps.length} steps done{isLive && totalLeft ? ` · about ${dur(totalLeft)} to go` : ""}
        {!isLive && s.finished_at ? ` · took ${dur((Date.parse(s.finished_at) - Date.parse(s.started_at)) / 1000)}` : ""}
      </div>
      {bar(isLive ? pctAll : 100, isLive ? "var(--madder)" : "var(--leaf)")}

      {running.map((x) => (
        <div key={x.step} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
          <div className="row between" style={{ flexWrap: "nowrap" }}>
            <strong>{x.step}</strong><span className="tiny faint">{dur(x.elapsed)} · ~{dur(x.left)} left</span>
          </div>
          <div className="tiny muted" style={{ margin: "4px 0 6px" }}>
            {x.phase === "captcha" ? "Waiting for someone to type the captcha (card at the bottom right)" : x.phase === "listing" ? `Reading organisation ${x.page} of ${x.of}` : x.phase === "details" ? `Opening each one: ${x.done} of ${x.total}` : "Opening the portal…"}
            {" · "}usually takes {dur(x.expected)}
          </div>
          {bar(x.pct)}
        </div>
      ))}

      {isLive && queued.length > 0 && (
        <div>
          <div className="kpi-label" style={{ marginTop: 6 }}>Queue ({queued.length})</div>
          {queued.map((q) => (
            <div key={q.step} className="row between small" style={{ padding: "4px 0", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap" }}>
              <span>{q.step}</span><span className="tiny faint" style={{ whiteSpace: "nowrap" }}>starts in ~{dur(q.startsIn)} · takes ~{dur(q.expected)}</span>
            </div>
          ))}
        </div>
      )}

      {finished.length > 0 && (
        <details open={!isLive}>
          <summary className="small"><strong>Finished ({finished.length})</strong></summary>
          {finished.map((f) => (
            <div key={f.step} className="row between small" style={{ padding: "4px 0", borderTop: "1px solid var(--line-soft)", flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span>{f.step}<div className="tiny faint">{f.error || f.note || ""}</div></span>
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>{f.seconds != null && <span className="tiny faint">{dur(f.seconds)}</span>}<span className={`chip ${CHIP[f.status][0]}`}>{CHIP[f.status][1]}</span></span>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
