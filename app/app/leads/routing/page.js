import Link from "next/link";
import { getContext } from "@/lib/session";
import Form from "./Form";

export const metadata = { title: "Lead routing" };

// New leads get an owner by themselves: a matching rule first, then turn by turn or to whoever has the fewest open leads.
export default async function Routing() {
  const { supabase, tenant, company, role } = await getContext();
  const [{ data: r }, { data: mem }] = await Promise.all([
    supabase.from("lead_routing").select("*").eq("company_id", company.id).maybeSingle(),
    supabase.from("tenant_members").select("user_id, role, profiles(full_name, email)").eq("tenant_id", tenant.id).not("role", "in", "(disabled,viewer)"),
  ]);
  const members = (mem || []).map((m) => ({ user_id: m.user_id, role: m.role, name: m.profiles?.full_name || m.profiles?.email || "Member" }));
  const initial = { enabled: !!r?.enabled, mode: r?.mode || "round_robin", members: r?.members || [], rules: r?.rules || [] };
  return (
    <div className="stack">
      <div className="page-head"><div><Link href="/app/leads" className="small">← Leads</Link><h1>Lead routing</h1>
        <p>Every new lead without an owner — from Google Maps, the autopilot, WhatsApp, forms, referrals or imports — gets one by itself, and that person gets a phone alert.</p></div></div>
      <Form initial={initial} members={members} canEdit={["admin", "manager"].includes(role)} />
    </div>
  );
}
