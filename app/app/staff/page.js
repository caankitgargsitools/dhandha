import { redirect } from "next/navigation";
import Link from "next/link";
import { getContext } from "@/lib/session";
import { activeIn, bankSheet, missingBank, RATES } from "@/lib/payroll";
import StaffForm from "./StaffForm";
import PayForm from "./PayForm";
import { finalisePayroll } from "./actions";

export const metadata = { title: "Staff & payroll" };
const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

// Staff & payroll (13 Nov, map item 10 part 2): the staff register and the monthly pay sheet — PF, ESI, professional tax,
// TDS and advances worked out, payslips and the bank-transfer sheet. Workspace admin only.
export default async function Staff({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) redirect("/app");
  const tab = sp?.tab === "pay" ? "pay" : "staff";
  const ist = new Date(Date.now() + 330 * 60000);
  const month = /^\d{4}-\d{2}$/.test(sp?.m || "") ? sp.m : `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
  const [{ data: staff }, { data: run }] = await Promise.all([
    supabase.from("staff").select("*").eq("company_id", company.id).order("name"),
    supabase.from("payroll_runs").select("*").eq("company_id", company.id).eq("month", month).maybeSingle(),
  ]);
  const all = staff || [];
  const current = all.filter((s) => !s.left_on || s.left_on >= ist.toISOString().slice(0, 10));
  const edit = sp?.new === "1" ? {} : all.find((s) => s.id === sp?.s) || null;
  const people = activeIn(all, month);
  const t = run?.totals || {};
  const csv = run?.lines?.length ? `data:text/csv;charset=utf-8,${encodeURIComponent(bankSheet(run.lines, month))}` : null;
  const noBank = run?.lines ? missingBank(run.lines) : [];
  const [y, m] = month.split("-").map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`, next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Staff & payroll</h1><p>Your staff register and the monthly pay sheet: pay for days worked, PF ({RATES.pfPct}% of basic up to ₹{RATES.pfWageCap.toLocaleString("en-IN")}), ESI (up to ₹{RATES.esiLimit.toLocaleString("en-IN")} gross), professional tax, TDS and advances — with payslips and a bank-transfer sheet. Only you (the workspace admin) can see this.</p></div></div>
      <div className="row" style={{ gap: 6 }}>
        <Link href="/app/staff" className={`btn sm ${tab === "staff" ? "" : "ghost"}`}>Staff ({current.length})</Link>
        <Link href={`/app/staff?tab=pay&m=${month}`} className={`btn sm ${tab === "pay" ? "" : "ghost"}`}>Payroll</Link>
      </div>
      {tab === "staff" ? (
        <>
          {edit ? <div className="panel stack-sm"><div className="row" style={{ justifyContent: "space-between" }}><strong>{edit.id ? `Edit ${edit.name}` : "Add a person"}</strong><Link href="/app/staff" className="small">Close</Link></div><StaffForm s={edit} /></div>
            : <div><Link href="/app/staff?new=1" className="btn sm">+ Add a person</Link></div>}
          {!all.length && <div className="panel empty-state"><p className="muted" style={{ margin: 0 }}>No staff yet. Add each person with their monthly gross pay; PF and ESI are worked out for you.</p></div>}
          <div className="stack-sm">
            {all.map((s) => (
              <Link key={s.id} href={`/app/staff?s=${s.id}`} className="panel row" style={{ padding: "10px 14px", justifyContent: "space-between", gap: 10, opacity: s.left_on && s.left_on < ist.toISOString().slice(0, 10) ? 0.55 : 1 }}>
                <div><strong>{s.name}</strong> <span className="small faint">{s.designation || ""}{s.left_on ? ` · left ${s.left_on}` : s.joined_on ? ` · since ${s.joined_on}` : ""}</span></div>
                <div className="small">{inr(s.gross)} a month {s.pf ? "· PF" : ""}{s.esi && s.gross <= RATES.esiLimit ? " · ESI" : ""}{!s.bank_account ? <span className="chip warn" style={{ marginLeft: 6 }}>no bank</span> : null}</div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Link href={`/app/staff?tab=pay&m=${prev}`} className="btn sm ghost">←</Link><strong>{new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</strong><Link href={`/app/staff?tab=pay&m=${next}`} className="btn sm ghost">→</Link>
            {run && <span className={`chip ${run.status === "final" ? "ok" : "warn"}`}>{run.status === "final" ? "Final" : "Draft"}</span>}
          </div>
          {!people.length ? <div className="panel empty-state"><p className="muted" style={{ margin: 0 }}>Nobody on the staff register this month. Add staff first.</p></div> : (
            <div className="panel"><PayForm month={month} people={people} lines={run?.lines} final={run?.status === "final"} /></div>
          )}
          {run && (
            <div className="grid-3">
              <div className="panel"><div className="kpi-label">Net pay to transfer</div><div className="kpi">{inr(t.net)}</div><div className="small faint">{t.people} people · cost to company {inr(t.ctc)}</div></div>
              <div className="panel"><div className="kpi-label">PF to deposit (EPFO)</div><div className="kpi">{inr(t.pf_due)}</div><div className="small faint">by the 15th of next month</div></div>
              <div className="panel"><div className="kpi-label">ESI to deposit (ESIC)</div><div className="kpi">{inr(t.esi_due)}</div><div className="small faint">by the 15th of next month · PT {inr(t.pt)} · TDS {inr(t.tds)}</div></div>
            </div>
          )}
          {run && (
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {csv && <a className="btn sm ghost" href={csv} download={`salary-${month}.csv`}>Download bank-transfer sheet</a>}
              {noBank.length > 0 && <span className="small" style={{ color: "var(--blood)" }}>No bank account: {noBank.join(", ")}</span>}
              {run.status === "draft" && <form action={finalisePayroll}><input type="hidden" name="month" value={month} /><button className="btn sm">Make final (cannot be changed after)</button></form>}
            </div>
          )}
          <p className="small faint">Rates used: PF {RATES.pfPct}% + {RATES.pfPct}% of basic (basic counted up to ₹{RATES.pfWageCap.toLocaleString("en-IN")}); ESI {RATES.esiEmpPct}% + {RATES.esiErPct}% when gross is up to ₹{RATES.esiLimit.toLocaleString("en-IN")}. Professional tax and TDS are the amounts you set per person. Check with your CA when rules change.</p>
        </>
      )}
    </div>
  );
}
