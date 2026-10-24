import { getAdminContext } from "@/lib/admin";
import Sessions from "./Sessions";

// Admin → Captcha session: once a day the admin opens a session on every portal and types its captcha; Dhandha keeps
// each session alive as long as the portal allows and learns how long that is, warning before it is likely to end.
export default async function CaptchaSession() {
  const { supabase } = await getAdminContext();
  const { data } = await supabase.rpc("portal_sessions_view");
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Captcha session</h1>
        <p>Start the day's session (a reminder comes at 09:31, before the 10:07 pre-check). Every portal opens and shows its captcha here; type each one. Dhandha keeps each session alive as long as the portal allows, learns how long that is, and alerts you to re-verify a portal before its session is likely to end. Captchas are always typed by a person.</p></div></div>
      <Sessions initial={data || []} />
    </div>
  );
}
