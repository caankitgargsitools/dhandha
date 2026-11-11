import Link from "next/link";
import { getContext } from "@/lib/session";
import { ScoreRing } from "@/components/Charts";
import { customerScore, healthSummary, BANDS } from "@/lib/customerScore";
import { waLink } from "@/lib/leads";

export const metadata = { title: "Customers" };
const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// Customer score (11 Nov, map item 6): every won customer with a 0–100 health score and the one thing to do next
export default async function Customers({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company } = await getContext();
  const { data, error } = await supabase.rpc("customer_health", { p_company: company.id });
  const rows = (data || []).map((c) => ({ ...c, h: customerScore(c) })).sort((a, b) => a.h.score - b.h.score);
  const band = ["healthy", "watch", "at_risk"].includes(sp?.band) ? sp.band : null;
  const shown = band ? rows.filter((r) => r.h.band === band) : rows;
  const s = healthSummary(rows);

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Customers</h1><p>Every customer you have won, scored 0–100 on how recently and how often they buy, how much, whether they pay on time, how often you talk and whether they refer or review. Lowest first, with the one thing to do next.</p></div></div>
      {error && <div className="notice bad small">{error.message}</div>}
      <div className="grid-3">
        {["at_risk", "watch", "healthy"].map((k) => (
          <Link key={k} href={band === k ? "/app/crm/customers" : `/app/crm/customers?band=${k}`} className="panel" style={{ outline: band === k ? "2px solid var(--primary)" : "none" }}>
            <div className="kpi-label">{BANDS[k][0]}</div>
            <div className="kpi">{s[k]}</div>
            <div className="small faint">{k === "at_risk" ? `${inr(s.riskValue)} of past business` : k === "healthy" ? `average score ${s.avg}` : "keep an eye"}</div>
          </Link>
        ))}
      </div>
      {!rows.length && <div className="panel empty-state"><p className="muted" style={{ margin: 0 }}>No customers yet. A lead becomes a customer when its deal is marked Won.</p></div>}
      <div className="stack-sm">
        {shown.map((c) => (
          <div key={c.lead_id} className="panel row" style={{ gap: 14, alignItems: "flex-start", padding: "14px 18px" }}>
            <ScoreRing score={c.h.score} size={52} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <Link href={`/app/leads/${c.lead_id}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                <span className={`chip ${BANDS[c.h.band][1]}`}>{BANDS[c.h.band][0]}</span>
                {c.city && <span className="small faint">{c.city}</span>}
              </div>
              <div className="small muted">{c.won_deals} won · {inr(c.won_value)}{c.open_deals ? ` · ${c.open_deals} open deal${c.open_deals === 1 ? "" : "s"}` : ""}{Number(c.invoiced) ? ` · invoiced ${inr(c.invoiced)}, paid ${inr(c.paid)}` : ""}</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {c.h.parts.map((p) => <span key={p.label} className={`chip plain ${p.pts >= p.max * 0.7 ? "ok" : p.pts >= p.max * 0.35 ? "mute" : "bad"}`} title={`${p.pts} of ${p.max}`}>{p.label} {p.pts}/{p.max}</span>)}
              </div>
              {c.h.flags.length > 0 && <div className="small" style={{ color: "var(--blood)" }}>{c.h.flags.join(" · ")}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              {c.h.next && <span className="small" style={{ fontWeight: 600 }}>Next: {c.h.next}</span>}
              <div className="row" style={{ gap: 6 }}>
                {c.phone && <a className="btn sm ghost" href={`tel:${c.phone}`}>Call</a>}
                {c.phone && <a className="btn sm ghost" href={waLink(c.phone, `Namaste ${c.contact_person || ""},`)} target="_blank" rel="noreferrer">WhatsApp</a>}
                <Link className="btn sm" href={`/app/leads/${c.lead_id}`}>Open</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
