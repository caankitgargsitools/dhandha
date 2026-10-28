"use client";
import { useState } from "react";
import { techTotals, qcbsScore, maxPriceToBeat, l1Advice } from "@/lib/evaluation";

const rs = (v) => (v === Infinity ? "any price" : `₹${Math.round(v).toLocaleString("en-IN")}`);
const num = (v) => Number(String(v).replace(/[^\d.]/g, "")) || 0;

// The tender's technical marking, and what it means for the price: the best price for an L1 tender, or the
// weighted final score (and the price that still beats a rival) for a QCBS tender.
export default function EvalPanel({ ev, estimate, cost, quote }) {
  const tot = techTotals(ev.criteria);
  const [price, setPrice] = useState(String(quote || ""));
  const [rivalTech, setRivalTech] = useState("70");
  const [rivalPrice, setRivalPrice] = useState(String(estimate ? Math.round(estimate * 0.9) : ""));
  const [margin, setMargin] = useState("5");
  const tw = ev.tech_weight || 0, fw = ev.fin_weight || 0, myTech = tot.score ?? 0;
  const lowest = Math.min(...[num(price), num(rivalPrice)].filter(Boolean));
  const me = ev.method === "QCBS" ? qcbsScore({ tech: myTech, price: num(price), lowest, tw, fw }) : null;
  const rival = ev.method === "QCBS" ? qcbsScore({ tech: num(rivalTech), price: num(rivalPrice), lowest, tw, fw }) : null;
  const beat = ev.method === "QCBS" ? maxPriceToBeat({ myTech, rivalTech: num(rivalTech), rivalPrice: num(rivalPrice), tw, fw }) : null;
  const l1 = ev.method !== "QCBS" ? l1Advice({ cost, estimate, minMargin: num(margin) }) : null;

  return (
    <div className="stack-sm" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
      <div className="row between"><strong>How this tender is evaluated</strong><span className="chip info">{ev.method === "QCBS" ? `QCBS ${tw}:${fw}` : ev.method === "QBS" ? "Quality only (QBS)" : ev.method === "L1" ? "L1 — lowest price wins" : "Other"}</span></div>
      {ev.formula && <div className="tiny faint">Tender says: “{ev.formula}”</div>}
      {ev.criteria.length > 0 && (
        <>
          <div className="table-wrap" style={{ border: "1px solid var(--line)", borderRadius: 8 }}>
            <table style={{ fontSize: 13 }}>
              <thead><tr><th>Criterion</th><th>Max</th><th>You</th><th>Why / how to get more</th></tr></thead>
              <tbody>
                {ev.criteria.map((c, i) => (
                  <tr key={i}><td>{c.criterion}{c.scoring && <div className="tiny faint">{c.scoring}</div>}</td><td>{c.max}</td>
                    <td><strong>{c.awarded === null ? "?" : c.awarded}</strong></td><td className="tiny">{c.basis}{c.raise && <div style={{ color: "var(--madder)" }}>{c.raise}</div>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="chip ok">Technical: {tot.got} / {tot.max} = {tot.score}%</span>
            {tot.unknown > 0 && <span className="chip warn">{tot.unknown} criterion{tot.unknown === 1 ? "" : "s"} decided on the day (presentation etc.)</span>}
            {ev.min_tech != null && <span className={`chip ${tot.got >= ev.min_tech ? "ok" : "bad"}`}>Minimum to qualify: {ev.min_tech}</span>}
          </div>
        </>
      )}

      {ev.method === "QCBS" && (
        <div className="stack-sm">
          <div className="form-grid">
            <div><label htmlFor="ev-p">Your price (₹, before GST)</label><input id="ev-p" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><label htmlFor="ev-rt">A strong rival's technical score (out of 100)</label><input id="ev-rt" inputMode="numeric" value={rivalTech} onChange={(e) => setRivalTech(e.target.value)} /></div>
            <div><label htmlFor="ev-rp">That rival's price (₹)</label><input id="ev-rp" inputMode="numeric" value={rivalPrice} onChange={(e) => setRivalPrice(e.target.value)} /></div>
          </div>
          {me && rival && (
            <div className="small">
              Your final score: <strong>{me.final}</strong> ({tw}% × {myTech} technical + {fw}% × {me.fin} financial) vs the rival's <strong>{rival.final}</strong> — {me.final >= rival.final ? <strong style={{ color: "var(--leaf)" }}>you are ahead</strong> : <strong style={{ color: "var(--blood)" }}>the rival is ahead</strong>}.
              {beat != null && <div>The highest price at which you still beat that rival: <strong>{beat === 0 ? "you cannot win on price alone — raise the technical score" : rs(beat)}</strong>.</div>}
            </div>
          )}
        </div>
      )}

      {ev.method !== "QCBS" && ev.method !== "QBS" && (
        <div className="small stack-sm">
          {cost ? (
            <>
              <div className="row" style={{ gap: 8, alignItems: "end" }}>
                <div style={{ maxWidth: 200 }}><label htmlFor="ev-m">Smallest margin you accept (%)</label><input id="ev-m" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} /></div>
              </div>
              <div>Best price to quote: <strong>{rs(l1.price)}</strong> + GST — your cost {rs(cost)} plus {num(margin)}%.{l1.belowEstimatePct != null && <> That is {l1.aboveEstimate ? <strong style={{ color: "var(--blood)" }}>above the estimate</strong> : `${l1.belowEstimatePct}% below the estimate`}.</>}</div>
              <div className="tiny faint">In an L1 tender every qualified bidder competes on price alone; quoting lower than this means working at a loss.</div>
            </>
          ) : <div className="muted">Work out your cost in the planner below and I'll show the best price to quote.</div>}
        </div>
      )}
    </div>
  );
}
