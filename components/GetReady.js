import { grouped } from "@/lib/prereq";

// "Get ready before you file": what to arrange for this tender, grouped (from lib/prereq.js prerequisiteList).
export default function GetReady({ items = [], compact = false }) {
  if (!items.length) return null;
  const groups = grouped(items);
  return (
    <div className="stack-sm" style={{ border: "1px solid var(--line)", borderRadius: 12, padding: compact ? "10px 12px" : "12px 14px", background: "var(--panel)" }}>
      <div className="row between">
        <strong className="small">Get ready before you file · {items.length} thing{items.length === 1 ? "" : "s"}</strong>
        {items.some((x) => x.warn) && <span className="chip warn tiny">Check the red ones first</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "10px 18px" }}>
        {groups.map((g) => (
          <div key={g.group}>
            <div className="tiny" style={{ fontWeight: 700, color: g.group === "unmet" ? "var(--blood)" : "var(--ink-2)", marginBottom: 4 }}>{g.title}</div>
            <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 3 }}>
              {g.items.map((x) => (
                <li key={x.key} style={{ color: x.warn ? "var(--blood)" : undefined }} title={x.quote || ""}>
                  {x.label}{x.page ? <span className="tiny faint"> · p. {x.page}</span> : null}{x.ai ? <span className="tiny faint"> · AI</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
