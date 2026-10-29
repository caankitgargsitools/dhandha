import FormState from "../../FormState";
import { KINDS, MODES } from "@/lib/deposits";
import { saveDeposit } from "./actions";

// add a deposit (EMD, BG, fee …) for a bid; matches = [{ id, title }] or a fixed matchId
export default function DepositForm({ matches = [], matchId, emd }) {
  return (
    <FormState action={saveDeposit} submit="Add">
      {matchId ? <input type="hidden" name="match_id" value={matchId} /> : (
        <div><label htmlFor="d-m">Tender</label><select id="d-m" name="match_id"><option value="">— Not linked to a tender —</option>{matches.map((m) => <option key={m.id} value={m.id}>{m.title.slice(0, 90)}</option>)}</select></div>
      )}
      <div className="form-grid">
        <div><label htmlFor="d-k">What</label><select id="d-k" name="kind" defaultValue="emd">{Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label htmlFor="d-a">Amount (₹)</label><input id="d-a" name="amount" inputMode="numeric" defaultValue={emd || ""} required /></div>
        <div><label htmlFor="d-md">Paid by</label><select id="d-md" name="mode" defaultValue="online">{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
        <div><label htmlFor="d-r">UTR / DD / BG number</label><input id="d-r" name="reference" maxLength={120} /></div>
        <div><label htmlFor="d-b">Bank</label><input id="d-b" name="bank" maxLength={120} /></div>
        <div><label htmlFor="d-p">Paid on</label><input id="d-p" name="paid_on" type="date" /></div>
        <div><label htmlFor="d-v">BG valid till</label><input id="d-v" name="valid_until" type="date" /></div>
      </div>
      <div><label htmlFor="d-n">Note</label><input id="d-n" name="note" maxLength={500} /></div>
    </FormState>
  );
}
