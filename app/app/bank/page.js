import { redirect } from "next/navigation";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { suggestMatches, recSummary } from "@/lib/bankRec";
import UploadForm from "./UploadForm";
import { confirmMatch, setLine } from "./actions";

export const metadata = { title: "Bank reconciliation" };
const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const TABS = { todo: "To match", matched: "Matched", ignored: "Ignored", all: "All" };

// Bank reconciliation (13 Nov, map item 10): upload the bank statement; money in is matched to open invoices and deposit
// refunds, money out to EMDs / BGs paid. Confirm with one tap; explain the rest with a note. Free, no AI.
export default async function Bank({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  if (!["admin", "manager"].includes(role)) redirect("/app");
  const tab = TABS[sp?.tab] ? sp.tab : "todo";
  let q = supabase.from("bank_lines").select("*").eq("company_id", company.id).order("txn_date", { ascending: false }).limit(400);
  if (tab === "todo") q = q.eq("status", "unmatched"); else if (tab !== "all") q = q.eq("status", tab);
  const [{ data: lines }, { data: allLines }, { data: inv }, { data: dep }] = await Promise.all([
    q,
    supabase.from("bank_lines").select("status, credit, debit, matched_kind, matched_id").eq("company_id", company.id).limit(5000),
    supabase.from("sales_invoices").select("id, number, client_name, totals, paid_amount, invoice_date, due_date").eq("company_id", company.id).in("status", ["issued", "sent", "part_paid", "overdue"]).limit(500),
    supabase.from("bid_deposits").select("id, kind, amount, status, paid_on, match_id, tender_matches(tenders(title))").eq("company_id", company.id).in("status", ["held", "refund_due"]).limit(500),
  ]);
  const used = new Set((allLines || []).filter((l) => l.status === "matched" && l.matched_kind === "deposit").map((l) => l.matched_id));
  const invoices = (inv || []).map((i) => ({ ...i, balance: (Number(i.totals?.total) || 0) - (Number(i.paid_amount) || 0) }));
  const deposits = (dep || []).map((d) => ({ ...d, title: d.tender_matches?.tenders?.title?.slice(0, 60) || "", bank_line_id: used.has(d.id) ? "x" : null }));
  const rows = tab === "todo" ? suggestMatches(lines || [], { invoices, deposits }) : (lines || []);
  const s = recSummary((allLines || []).map((l) => ({ ...l, match: null })));
  const toCheck = tab === "todo" ? rows.filter((r) => r.match).length : 0;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Bank reconciliation</h1><p>Upload your bank statement (CSV or Excel from net banking). Money in is matched to your open invoices and deposit refunds, money out to EMDs and bank guarantees you paid. Confirm each match with one tap — the invoice is marked paid. Nothing leaves Dhandha; no AI.</p></div></div>
      <div className="panel"><UploadForm /></div>
      <div className="grid-3">
        <div className="panel"><div className="kpi-label">Lines to match</div><div className="kpi">{s.unmatched}</div><div className="small faint">{toCheck ? `${toCheck} with a suggested match` : "of " + s.lines}</div></div>
        <div className="panel"><div className="kpi-label">Matched</div><div className="kpi">{s.matched}</div><div className="small faint">{s.ignored} ignored</div></div>
        <div className="panel"><div className="kpi-label">In / out (uploaded)</div><div className="kpi" style={{ fontSize: 20 }}>{inr(s.in)} / {inr(s.out)}</div></div>
      </div>
      <div className="row" style={{ gap: 6 }}>{Object.entries(TABS).map(([k, l]) => <Link key={k} href={`/app/bank?tab=${k}`} className={`btn sm ${tab === k ? "" : "ghost"}`}>{l}</Link>)}</div>
      {!rows.length && <div className="panel empty-state"><p className="muted" style={{ margin: 0 }}>{s.lines ? "Nothing here." : "No statement yet. In your net banking, download the account statement for a period as CSV or Excel and upload it above."}</p></div>}
      <div className="stack-sm">
        {rows.map((l) => (
          <div key={l.id} className="panel" style={{ padding: "10px 14px" }}>
            <div className="row" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="small faint">{l.txn_date}{l.ref ? ` · ${l.ref}` : ""} · {l.account}</div>
                <div className="small" style={{ wordBreak: "break-word" }}>{l.narration || "(no narration)"}</div>
              </div>
              <strong style={{ color: l.credit ? "var(--leaf)" : "var(--blood)", fontVariantNumeric: "tabular-nums" }}>{l.credit ? `+ ${inr(l.credit)}` : `− ${inr(l.debit)}`}</strong>
            </div>
            {l.status === "unmatched" ? (
              <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
                {[l.match, ...(l.others || [])].filter(Boolean).map((m) => (
                  <form key={m.kind + m.id} action={confirmMatch}><input type="hidden" name="line" value={l.id} /><input type="hidden" name="kind" value={m.kind} /><input type="hidden" name="target" value={m.id} />
                    <button className={`btn sm ${m === l.match ? "" : "ghost"}`}>{m === l.match && m.sure ? "✓ " : ""}{m.label}</button></form>
                ))}
                <form action={setLine} className="row" style={{ gap: 6 }}>
                  <input type="hidden" name="line" value={l.id} />
                  <input name="note" placeholder={l.debit ? "e.g. rent, salary, GST" : "e.g. capital, loan"} style={{ width: 170 }} />
                  <button name="what" value="other" className="btn sm ghost">Explain</button>
                  <button name="what" value="ignore" className="btn sm ghost">Ignore</button>
                </form>
              </div>
            ) : (
              <div className="row small faint" style={{ gap: 8, marginTop: 6, alignItems: "center" }}>
                <span className={`chip ${l.status === "matched" ? "ok" : "mute"}`}>{l.status === "matched" ? ({ invoice: "Invoice paid", refund: "Refund received", deposit: "Deposit paid", other: "Explained" }[l.matched_kind]) : "Ignored"}</span>
                {l.note && <span>{l.note}</span>}
                {l.matched_kind !== "invoice" && <form action={setLine}><input type="hidden" name="line" value={l.id} /><button name="what" value="undo" className="btn sm ghost">Undo</button></form>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
