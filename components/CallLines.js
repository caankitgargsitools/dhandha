import Link from "next/link";
import { StageBars } from "@/components/Charts";
import { FEW } from "@/lib/callLearning";

const pct = (x) => `${Math.round(x * 100)}%`;
const OUT = { interested: "Interested", call_back: "Call back", not_interested: "Not interested", connected: "Talked, no result", "no result": "No result" };

// Call learning: how far calls get, and lines that work / lose people (read from what the client did next).
export function CallFunnel({ funnel }) {
  if (!funnel.calls) return null;
  return (
    <div className="grid-2" style={{ alignItems: "start" }}>
      <div className="panel">
        <h3>How far calls get</h3>
        <StageBars rows={funnel.reach.map((n, i) => ({ label: `Line ${i + 1}`, value: n }))} format={(v) => `${v} call${v === 1 ? "" : "s"}`} />
        <p className="tiny faint" style={{ margin: "8px 0 0" }}>{funnel.calls} calls · average {Math.floor(funnel.avgSeconds / 60)} min {funnel.avgSeconds % 60} s · the client hung up in {pct(funnel.hungUp / funnel.calls)}</p>
      </div>
      <div className="panel">
        <h3>How calls ended</h3>
        <StageBars rows={Object.entries(funnel.outcomes).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: OUT[k] || k, value: v, color: k === "interested" || k === "call_back" ? "var(--ok)" : k === "not_interested" ? "var(--bad)" : undefined }))} />
      </div>
    </div>
  );
}

export function LineTable({ title, hint, rows, link }) {
  return (
    <div className="panel flush table-wrap">
      <h3 style={{ padding: "14px 16px 0" }}>{title}</h3>
      {hint && <p className="tiny faint" style={{ padding: "0 16px", margin: 0 }}>{hint}</p>}
      <table>
        <thead><tr><th>Dhandha AI said</th><th>Used</th><th>Client answered</th><th>Cut in</th><th>Hung up after it</th><th>In good calls</th></tr></thead>
        <tbody>
          {!rows.length && <tr><td colSpan={6} className="muted" style={{ padding: 18 }}>Nothing yet.</td></tr>}
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="small" style={{ maxWidth: 420 }}>
                {r.text}
                <div className="tiny faint">usually line {r.turn}{r.few ? ` · only ${r.said} use${r.said === 1 ? "" : "s"} — a hint until ${FEW}` : ""}</div>
                {link && (r.example || r.sample) && <Link className="tiny" href={link(r.example || r.sample)}>Open the call →</Link>}
              </td>
              <td>{r.said}</td>
              <td>{pct(r.replied / r.said)}</td>
              <td>{r.interrupted ? pct(r.interruptRate) : "—"}</td>
              <td>{r.hungUp ? <strong style={{ color: "var(--bad)" }}>{r.hungUp} · {pct(r.hungUpRate)}</strong> : "—"}</td>
              <td>{r.good ? <span style={{ color: "var(--ok)" }}>{pct(r.goodRate)}</span> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
