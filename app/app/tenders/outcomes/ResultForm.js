import FormState from "../../FormState";
import { STAGES } from "@/lib/outcomes";
import { saveResult } from "./actions";

// record what happened after the bid was opened
export default function ResultForm({ m }) {
  return (
    <FormState action={saveResult} submit="Save result">
      <input type="hidden" name="match_id" value={m.id} />
      <div><label htmlFor="r-s">What happened</label><select id="r-s" name="result_stage" defaultValue={m.result_stage || ""}><option value="">— Not opened yet —</option>{Object.entries(STAGES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
      <div><label htmlFor="r-why">Reason (if disqualified)</label><input id="r-why" name="result_reason" maxLength={300} defaultValue={m.result_reason || ""} placeholder="e.g. Turnover short, experience certificate not accepted" /></div>
      <div className="form-grid">
        <div><label htmlFor="r-rank">Our rank (L1 = 1)</label><input id="r-rank" name="our_rank" inputMode="numeric" defaultValue={m.our_rank || ""} /></div>
        <div><label htmlFor="r-n">Bidders</label><input id="r-n" name="bidders" inputMode="numeric" defaultValue={m.bidders || ""} /></div>
        <div><label htmlFor="r-q">Our price (₹)</label><input id="r-q" name="quoted_price" inputMode="numeric" defaultValue={m.quoted_price || ""} /></div>
        <div><label htmlFor="r-l1">L1 price (₹)</label><input id="r-l1" name="l1_price" inputMode="numeric" defaultValue={m.l1_price || ""} /></div>
      </div>
      <p className="tiny faint" style={{ margin: 0 }}>Disqualified, cancelled or not L1 marks the bid lost (its EMD falls due for refund); &ldquo;Awarded to us&rdquo; marks it won.</p>
    </FormState>
  );
}
