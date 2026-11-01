import Link from "next/link";

const MARK = { ok: ["✓", "var(--leaf)"], bad: ["✗", "var(--blood)"], ask: ["?", "var(--marigold)"] };

// The tender's money tests (aggregate turnover, liquid assets, net worth, profit each year) against the Vault.
export default function FinTests({ rows, title = "Money tests in this tender", href = "/app/vault/facts", link = "Vault → Facts" }) {
  if (!rows?.length) return null;
  return (
    <div className="panel stack-sm">
      <div className="row between"><strong>{title}</strong><Link href={href} className="small">{link}</Link></div>
      <div className="table-wrap"><table style={{ fontSize: 13 }}>
        <thead><tr><th></th><th>Test</th><th>Needed</th><th>Your Vault</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.key}><td style={{ color: MARK[r.state][1], fontWeight: 700 }}>{MARK[r.state][0]}</td><td>{r.label}{r.note && <div className="tiny faint">{r.note}</div>}</td><td>{r.need}</td><td className="tiny">{r.have}</td></tr>
        ))}</tbody>
      </table></div>
      <div className="tiny faint">Read free from the tender text; check the exact wording in the tender before filing.</div>
    </div>
  );
}
