import { getContext } from "@/lib/session";
import { leadAddress, local } from "@/lib/scheduling";
import Planner from "./Planner";

export const maxDuration = 60;

// Plan visits: several clients on one day, shared out across the field team so the least driving is done.
export default async function PlanVisits() {
  const { supabase, company } = await getContext();
  const [{ data: leads }, { data: types }] = await Promise.all([
    supabase.from("leads").select("id, name, address, notes, city, state, status").eq("company_id", company.id).not("status", "in", "(junk,not_interested)").order("updated_at", { ascending: false }).limit(400),
    supabase.from("meeting_types").select("id, name, duration_min, buffer_min").eq("company_id", company.id).eq("mode", "field").eq("active", true).order("name"),
  ]);
  // only leads with a real street address (not just a city) are worth routing
  const list = (leads || []).map((l) => ({ id: l.id, name: l.name, address: leadAddress(l) })).filter((l) => l.address && (l.address.includes(",") || /\d/.test(l.address)));
  return (
    <>
      <div className="page-head"><div><h1>Plan visits</h1><p>Tick the clients to visit on a day. Dhandha prices every drive with Google, gives each visit to the salesperson whose route passes nearest, and orders each day so the team drives the least. Review, then book them all at once.</p></div></div>
      <Planner leads={list} types={types || []} today={local(new Date()).day} />
    </>
  );
}
