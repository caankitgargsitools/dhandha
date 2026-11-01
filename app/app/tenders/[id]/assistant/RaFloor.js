"use client";
import { useState } from "react";
import { raFloor } from "@/lib/gemFields";

const rs = (n) => `₹${Math.round(n).toLocaleString("en-IN")}`;

// GeM bid with a reverse auction: the price below which you stop cutting (cost + smallest margin).
export default function RaFloor({ cost, quote }) {
  const [m, setM] = useState("3");
  const r = raFloor({ cost, minMargin: Number(m), quote });
  return (
    <div className="stack-sm" style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
      <div className="row between"><strong>Reverse auction: your floor</strong><span className="chip warn">Prices are cut live</span></div>
      {r ? (
        <>
          <div className="row" style={{ gap: 8, alignItems: "end" }}><div style={{ maxWidth: 220 }}><label htmlFor="ra-m">Smallest margin you accept in the auction (%)</label><input id="ra-m" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} /></div></div>
          <div className="small">Do not go below <strong>{rs(r.floor)}</strong> + GST — your cost {rs(cost)} plus {Number(m) || 0}%.{r.room != null && <> Your quote leaves {r.room > 0 ? <strong>{rs(r.room)} ({r.roomPct}%) to cut</strong> : <strong style={{ color: "var(--blood)" }}>no room — it is already below the floor</strong>}.</>}</div>
          <div className="tiny faint">Write the floor down before the auction starts; decisions in the last minutes are where losses happen.</div>
        </>
      ) : <div className="muted small">Work out your cost in the planner below and I&apos;ll show the lowest price to accept in the auction.</div>}
    </div>
  );
}
