import { redirect } from "next/navigation";
import { getContext } from "@/lib/session";
import { rupeesInWords } from "@/lib/payroll";
import PrintButton from "./PrintButton";

export const metadata = { title: "Payslip" };
const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default async function Payslip({ searchParams }) {
  const sp = await searchParams;
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) redirect("/app");
  const [{ data: run }, { data: c }] = await Promise.all([
    supabase.from("payroll_runs").select("month, status, lines").eq("company_id", company.id).eq("month", String(sp?.m || "")).maybeSingle(),
    supabase.from("companies").select("legal_name, registered_address, city, state").eq("id", company.id).maybeSingle(),
  ]);
  const l = (run?.lines || []).find((x) => x.staff_id === sp?.s);
  if (!l) return <div className="notice bad">Payslip not found — work out the month's pay first.</div>;
  const [y, m] = run.month.split("-").map(Number);
  const rows = [["Basic", l.basic, "PF (employee)", l.pf_emp], ["Other allowances", l.other, "ESI (employee)", l.esi_emp], ["Bonus / extra", l.bonus, "Professional tax", l.pt], ["", null, "TDS", l.tds], ["", null, "Advance recovered", l.advance]];
  return (
    <div className="panel stack-sm payslip" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div><strong style={{ fontSize: 18 }}>{c?.legal_name}</strong><div className="small muted">{[c?.registered_address, c?.city, c?.state].filter(Boolean).join(", ")}</div></div>
        <PrintButton />
      </div>
      <h2 style={{ margin: "6px 0" }}>Payslip — {new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}{run.status === "draft" ? " (draft)" : ""}</h2>
      <div className="small">{l.name}{l.designation ? ` · ${l.designation}` : ""} · Paid days {l.days} of {l.total_days}{l.uan ? ` · UAN ${l.uan}` : ""}{l.esic_no ? ` · ESIC ${l.esic_no}` : ""}{l.pan ? ` · PAN ${l.pan}` : ""}</div>
      <table className="small">
        <thead><tr><th>Earnings</th><th style={{ textAlign: "right" }}>₹</th><th>Deductions</th><th style={{ textAlign: "right" }}>₹</th></tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}><td>{r[0]}</td><td style={{ textAlign: "right" }}>{r[1] != null && r[0] ? inr(r[1]) : ""}</td><td>{r[2]}</td><td style={{ textAlign: "right" }}>{inr(r[3])}</td></tr>)}
          <tr><td><strong>Total earnings</strong></td><td style={{ textAlign: "right" }}><strong>{inr(l.earned)}</strong></td><td><strong>Total deductions</strong></td><td style={{ textAlign: "right" }}><strong>{inr(l.deductions)}</strong></td></tr>
        </tbody>
      </table>
      <div><strong>Net pay: {inr(l.net)}</strong> <span className="small muted">({rupeesInWords(l.net)})</span></div>
      <div className="small faint">Employer's share (not deducted): PF {inr(l.pf_er)}, ESI {inr(l.esi_er)}. {l.bank_account ? `Paid to account ending ${String(l.bank_account).slice(-4)}.` : ""} This is a computer-generated payslip.</div>
    </div>
  );
}
