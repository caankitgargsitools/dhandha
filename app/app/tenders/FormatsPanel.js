"use client";
import { useActionState } from "react";
import { prepareFormats } from "./formatActions";

const KIND = {
  covering_letter: "Covering letter", bidder_info: "Bidder information", turnover: "Turnover / net worth", similar_works: "Similar works",
  key_personnel: "Key personnel", non_blacklisting: "Non-blacklisting", mse: "MSE declaration", price: "Price bid", custom: "Tender's own wording",
};

export default function FormatsPanel({ matchId, plan, gaps, canEdit, paidAi, hasFormats }) {
  const [state, action, pending] = useActionState(prepareFormats, {});
  const custom = plan.filter((p) => p.kind === "custom" && !p.tpl && !p.filled_text && !p.edited_text); // only formats still empty go to AI
  return (
    <div className="stack-sm">
      {!plan.length && <p className="small muted" style={{ margin: 0 }}>{hasFormats ? "Match the tender's formats to the template library to see how each will be filled." : "Read the tender first to find its formats."}</p>}
      {plan.map((p, i) => (
        <div key={i} className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start", borderTop: i ? "1px solid var(--line-soft)" : 0, paddingTop: i ? 8 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <strong className="small">{p.title}</strong>
            <div className="tiny faint">{KIND[p.kind]}{p.page ? ` · p. ${p.page}` : ""}</div>
          </div>
          {p.kind === "price" ? <span className="chip mute">Fill rates on portal</span>
            : p.kind !== "custom" ? <span className="chip ok">Free template</span>
            : p.filled_text ? <span className="chip info">Filled by AI{p.missing?.length ? ` · ${p.missing.length} blank` : ""}</span>
            : <span className="chip warn">Needs AI fill</span>}
        </div>
      ))}
      {canEdit && hasFormats && (
        <form action={action} className="row" style={{ gap: 8 }}>
          <input type="hidden" name="match_id" value={matchId} />
          <button aria-busy={!!pending} name="ai" value="0" className="ghost sm" disabled={pending}>{pending ? "Working…" : plan.length ? "Re-match formats (free)" : "Match formats (free)"}</button>
          {custom.length > 0 && <button aria-busy={!!pending} name="ai" value="1" className="sm" disabled={pending || !paidAi} title={paidAi ? "" : "Needs a paid AI key"}>{pending ? "Filling…" : `Fill ${custom.length} custom with AI · 49 credits`}</button>}
        </form>
      )}
      {custom.length > 0 && !paidAi && <p className="tiny faint" style={{ margin: 0 }}>Custom formats contain your company data, so they are never sent to free AI. Add a paid AI key (Claude) to fill them, or type them in after downloading the draft.</p>}
      {state?.error && <p className="error small">{state.error}</p>}
      {state?.message && <p className="success small">{state.message}</p>}
      {gaps.length > 0 && canEdit && (
        <div className="notice small" style={{ display: "block" }}>
          <strong>{gaps.length} detail{gaps.length === 1 ? "" : "s"} the formats still need</strong> ({gaps.slice(0, 4).map((g) => g.label).join(", ")}{gaps.length > 4 ? "…" : ""}).{" "}
          The <a href={`/app/tenders/${matchId}/assistant`}>tender assistant</a> asks them one at a time and saves each to your Vault, so no tender asks again.
        </div>
      )}
    </div>
  );
}
