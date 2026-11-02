import { getAdminContext } from "@/lib/admin";
import { groupLines } from "@/lib/eligLines";
import { sectorOf, sectorLabel } from "@/lib/formatHarvest";

export const dynamic = "force-dynamic";

// What tenders ask of bidders that Dhandha has no rule for yet, the same requirement grouped across tenders, most
// often asked first. Frequent ones become new credentials (lib/credentials.js) or conditions — tell Claude which.
export default async function EligibilityToLearn() {
  const { supabase } = await getAdminContext();
  const { data, error } = await supabase.rpc("eligibility_lines", { p_limit: 800 });
  if (error) return <div className="panel small">Could not load: {error.message}</div>;
  const groups = groupLines(data || []);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Eligibility to learn</h1>
        <p>Conditions tenders put on bidders that no credential, money test or yes/no question in Dhandha understands yet — read free from every fetched tender. The same requirement in other words is grouped. The most asked ones are the next credentials to add.</p></div></div>
      {!groups.length ? <div className="panel small muted">Nothing yet — lines appear as tenders are pre-checked (the reader keeps them from 2 Nov).</div> : (
        <div className="panel">
          <div className="table-wrap"><table style={{ fontSize: 13 }}>
            <thead><tr><th className="right">Tenders</th><th>Requirement</th><th>Industry</th><th>Example tender</th></tr></thead>
            <tbody>{groups.slice(0, 200).map((g, i) => (
              <tr key={i}>
                <td className="right num"><strong>{g.tenders}</strong></td>
                <td>{g.line}{g.variants.length > 0 && <details><summary className="tiny faint" style={{ cursor: "pointer" }}>{g.variants.length} other wording{g.variants.length === 1 ? "" : "s"}</summary><ul className="tiny" style={{ margin: "4px 0 0", paddingLeft: 16 }}>{g.variants.slice(0, 8).map((v, j) => <li key={j}>{v}</li>)}</ul></details>}</td>
                <td className="small">{g.example ? sectorLabel(sectorOf({ title: g.example })) : "—"}</td>
                <td className="tiny faint">{g.example || "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
