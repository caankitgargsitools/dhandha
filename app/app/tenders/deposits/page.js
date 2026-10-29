import Link from "next/link";
import { getContext, lakh, fmtDate } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import { KINDS, MODES, STATUS, depositSummary, daysTo, refundLetter } from "@/lib/deposits";
import DepositForm from "./DepositForm";
import { setDepositStatus } from "./actions";

export const metadata = { title: "EMD & bank guarantees" };

export default async function Deposits({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, role } = await getContext();
  const canEdit = ["admin", "manager", "bid_preparer"].includes(role);
  const [{ data: rows }, { data: ms }, { data: c }] = await Promise.all([
    supabase.from("bid_deposits").select("*, tender_matches(id, tenders(title, tender_ref, authority))").eq("company_id", company.id).order("created_at", { ascending: false }),
    supabase.from("tender_matches").select("id, tenders(title)").eq("company_id", company.id).in("status", ["preparing", "submitted", "won", "lost", "shortlisted"]).limit(200),
    supabase.from("companies").select("legal_name").eq("id", company.id).single(),
  ]);
  const list = rows || [];
  const s = depositSummary(list);
  const show = sp?.show === "all" ? list : list.filter((r) => ["held", "refund_due"].includes(r.status));
  const letterFor = list.find((r) => r.id === sp?.letter);

  return (
    <div className="stack">
      <Link href="/app/tenders" className="small">All tenders</Link>
      <div className="page-head"><div><h1>EMD &amp; bank guarantees</h1><p>Every deposit you give for a bid — EMD, bank guarantee, tender fee, performance security — with its refund. A lost bid&apos;s EMD falls due for refund by itself; your phone is alerted when a refund is late or a bank guarantee is about to expire.</p></div></div>
      <div className="grid-3">
        <div className="panel"><div className="tiny faint">With departments</div><div style={{ fontSize: 24, fontWeight: 700 }}>{lakh(s.held.amount)}</div><div className="tiny faint">{s.held.count} deposits{s.expiring.count ? ` · ${s.expiring.count} BG expiring in 30 days` : ""}</div></div>
        <div className="panel"><div className="tiny faint">Refunds due</div><div style={{ fontSize: 24, fontWeight: 700, color: s.late.count ? "var(--blood)" : undefined }}>{lakh(s.due.amount)}</div><div className="tiny faint">{s.due.count} due{s.late.count ? ` · ${s.late.count} late (${lakh(s.late.amount)})` : ""}</div></div>
        <div className="panel"><div className="tiny faint">Refunded in 12 months</div><div style={{ fontSize: 24, fontWeight: 700 }}>{lakh(s.refundedYear.amount)}</div><div className="tiny faint">Tender fees paid: {lakh(s.feesYear)}</div></div>
      </div>

      {letterFor && (
        <div className="panel stack-sm">
          <div className="row between"><h3 style={{ margin: 0 }}>Refund request letter</h3><Link className="small" href="/app/tenders/deposits">Close</Link></div>
          <textarea rows={16} defaultValue={refundLetter({ company: c?.legal_name, authority: letterFor.tender_matches?.tenders?.authority, title: letterFor.tender_matches?.tenders?.title, ref: letterFor.tender_matches?.tenders?.tender_ref, amount: letterFor.amount, mode: MODES[letterFor.mode]?.split(" (")[0], reference: letterFor.reference, paidOn: letterFor.paid_on ? fmtDate(letterFor.paid_on) : null })} />
          <p className="tiny faint" style={{ margin: 0 }}>Copy it onto your letterhead, sign and send it to the department (by email or the portal&apos;s refund request).</p>
        </div>
      )}

      <div className="grid-main">
        <div className="panel flush table-wrap">
          <div className="row between" style={{ padding: "14px 16px 6px" }}><h3 style={{ margin: 0 }}>{sp?.show === "all" ? "All deposits" : "Open deposits"}</h3><Link className="small" href={sp?.show === "all" ? "/app/tenders/deposits" : "/app/tenders/deposits?show=all"}>{sp?.show === "all" ? "Only open" : "Show all"}</Link></div>
          <table>
            <thead><tr><th>Tender</th><th>What</th><th>Amount</th><th>Dates</th><th>Status</th><th /></tr></thead>
            <tbody>
              {!show.length && <tr><td colSpan={6} className="muted small">Nothing open. Add the EMD when you submit a bid.</td></tr>}
              {show.map((r) => { const [cls, txt] = STATUS[r.status]; const exp = daysTo(r.valid_until), late = r.status === "refund_due" && daysTo(r.refund_expected_on) < 0; return (
                <tr key={r.id}>
                  <td className="small">{r.tender_matches ? <Link href={`/app/tenders/${r.tender_matches.id}`}>{r.tender_matches.tenders?.title?.slice(0, 80)}</Link> : <span className="faint">Not linked</span>}{r.note && <div className="tiny faint">{r.note}</div>}</td>
                  <td className="small">{KINDS[r.kind]}<div className="tiny faint">{[MODES[r.mode]?.split(" (")[0], r.reference, r.bank].filter(Boolean).join(" · ")}</div></td>
                  <td className="num small">{lakh(r.amount)}</td>
                  <td className="tiny">{r.paid_on && <div>Paid {fmtDate(r.paid_on)}</div>}{r.valid_until && <div style={{ color: exp !== null && exp <= 30 && r.status === "held" ? "var(--blood)" : undefined }}>BG till {fmtDate(r.valid_until)}{exp !== null && exp >= 0 && exp <= 30 ? ` (${exp} days)` : ""}</div>}{r.refund_expected_on && r.status === "refund_due" && <div style={{ color: late ? "var(--blood)" : undefined }}>Refund by {fmtDate(r.refund_expected_on)}</div>}{r.refunded_on && <div>Refunded {fmtDate(r.refunded_on)}</div>}</td>
                  <td><span className={`chip ${late ? "bad" : cls}`}>{late ? "Refund late" : txt}</span></td>
                  <td>{canEdit && ["held", "refund_due"].includes(r.status) && (
                    <div className="row" style={{ gap: 4 }}>
                      <form action={setDepositStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="refunded" /><SubmitButton className="sm ghost">Refunded</SubmitButton></form>
                      {r.status === "held" && <form action={setDepositStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="refund_due" /><SubmitButton className="sm ghost">Ask for it back</SubmitButton></form>}
                      {r.status === "refund_due" && r.kind === "emd" && <Link className="btn sm ghost" href={`/app/tenders/deposits?letter=${r.id}`}>Letter</Link>}
                    </div>)}</td>
                </tr>); })}
            </tbody>
          </table>
        </div>
        {canEdit && <div className="panel"><h3>Add a deposit</h3><DepositForm matches={(ms || []).filter((m) => m.tenders).map((m) => ({ id: m.id, title: m.tenders.title }))} /></div>}
      </div>
    </div>
  );
}
