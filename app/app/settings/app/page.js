import { getContext } from "@/lib/session";
import PhoneApp from "./PhoneApp";

export default async function PhoneAppPage() {
  const { supabase, user } = await getContext();
  const { data: devices } = await supabase.from("push_subscriptions").select("device, created_at").eq("user_id", user.id).is("revoked_at", null).order("created_at");
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div><h1>Phone app</h1><p className="muted" style={{ margin: 0 }}>Use Dhandha like an app on your phone: its own icon, full screen, and notifications when something needs you.</p></div>
      <PhoneApp devices={devices || []} />
    </div>
  );
}
