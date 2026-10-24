import Link from "next/link";
import { getContext } from "@/lib/session";
import AutopilotForm from "./AutopilotForm";

const SRC = { google_maps: "Google Maps", tender_winner: "Tender winners", mca: "New companies", all: "—" };

// Lead autopilot: a daily budget, the sources, and the follow-up — run every morning; each run is listed.
export default async function Autopilot() {
  const { supabase, tenant, company, isAdmin } = await getContext();
  const [{ data: a }, { data: sequences }, { data: types }, { data: prices }, { data: wallet }, { data: runs }] = await Promise.all([
    supabase.from("lead_autopilot").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("sequences").select("id, name, active, sequence_steps(channel)").eq("company_id", company.id).order("name"),
    supabase.from("meeting_types").select("id, name").eq("company_id", company.id).eq("active", true).order("name"),
    supabase.from("price_book").select("action_code, credits").in("action_code", ["lead_found", "email_send", "whatsapp_send", "ai_call_min"]),
    supabase.from("wallets").select("balance").eq("tenant_id", tenant.id).maybeSingle(),
    supabase.from("autopilot_runs").select("*").eq("company_id", company.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const p = Object.fromEntries((prices || []).map((x) => [x.action_code, Number(x.credits)]));
  return (
    <div className="stack">
      <Link href="/app/leads/generate" className="small">Generate leads</Link>
      <div className="page-head"><div><h1>Lead autopilot</h1><p>Set a daily budget and where to look. Every morning Dhandha finds new leads, scores them, messages the best and moves each one through the CRM by itself. <Link href="/app/leads/results">See results by source</Link>.</p></div></div>
      <AutopilotForm a={a || {}} sequences={sequences || []} types={types || []} prices={p} balance={Number(wallet?.balance || 0)} canEdit={isAdmin} callReady={false} />
      <div className="panel flush table-wrap">
        <div className="panel-head" style={{ padding: "14px 16px 0" }}><h3>Recent runs</h3>{a?.last_run_on && <span className="tiny faint">last run {a.last_run_on}</span>}</div>
        <table>
          <thead><tr><th>When</th><th>Source</th><th className="num">Added</th><th className="num">Spent</th><th>Notes</th></tr></thead>
          <tbody>
            {!runs?.length && <tr><td colSpan={5} className="muted small">No runs yet. Switch the autopilot on and save — the first run is tomorrow morning, or press “Run today's batch now”.</td></tr>}
            {(runs || []).map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                <td>{SRC[r.source] || r.source}</td><td className="num">{r.added}</td><td className="num">₹{Number(r.credits)}</td><td className="small muted">{r.note || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
