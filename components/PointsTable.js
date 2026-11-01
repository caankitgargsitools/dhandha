import Link from "next/link";

// A tender's points table (GeM QCBS / technical marks) with the firm's own figure for each parameter (lib/firmPoints.js).
export default function PointsTable({ table, rows }) {
  if (!table || !rows?.length) return null;
  const max = rows.reduce((s, r) => s + r.max, 0), missing = rows.filter((r) => r.state === "ask").length;
  return (
    <div className="panel stack-sm">
      <div className="row between"><strong>How your firm is marked</strong>
        <span className="row" style={{ gap: 6 }}>{table.method && <span className="chip info">{table.method}{table.tech_weight ? ` ${table.tech_weight}:${table.fin_weight}` : ""}</span>}{table.qualifying && <span className="chip mute">Qualify at {table.qualifying} of {max}</span>}</span></div>
      <div className="table-wrap"><table style={{ fontSize: 13 }}>
        <thead><tr><th>Parameter</th><th className="right">Max</th><th className="right">Cut-off</th><th>Your Vault</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td>{r.name}{r.about && <div className="tiny faint">{r.about}</div>}</td><td className="right num">{r.max}</td><td className="right num">{r.cutoff}</td>
            <td className="small">{r.have || (r.state === "ask" ? <span style={{ color: "var(--marigold)" }}>Not in the Vault</span> : <span className="faint">Judged on your write-up</span>)}</td></tr>
        ))}</tbody>
      </table></div>
      <div className="tiny faint">Each parameter must reach its cut-off. How many marks each figure earns is in the buyer&apos;s file (“View File” on GeM).{missing > 0 && <> {missing} figure{missing === 1 ? " is" : "s are"} missing — add them in <Link href="/app/vault/credentials">Credentials</Link>, Facts or Experience.</>}</div>
    </div>
  );
}
