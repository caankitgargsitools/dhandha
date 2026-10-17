import { getContext, fmtDate } from "@/lib/session";
import { driveReady } from "@/lib/google";
import { disconnectDrive } from "../../actions";

const ERRORS = {
  state: "The sign-in took too long or came from another tab. Please try again.",
  denied: "Google access was not granted.",
  admin_only: "Only the workspace admin can connect Google Drive.",
  not_configured: "Google sign-in is not switched on yet. Please ask Dhandha support.",
  no_refresh: "Google did not give lasting access. Remove Dhandha at myaccount.google.com/permissions and connect again.",
  scope: "Please tick the Google Drive permission on Google's screen.",
  save: "Could not save the connection. Please try again.",
  google: "Google returned an error. Please try again.",
};

export default async function DriveSettings({ searchParams }) {
  const sp = await searchParams;
  const { supabase, tenant, isAdmin } = await getContext();
  const { data: c } = await supabase.from("drive_connections").select("google_email, connected_at, revoked_at, token_enc").eq("tenant_id", tenant.id).maybeSingle();
  const on = !!(c?.token_enc && !c.revoked_at);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Google Drive</h1><p>Keep your documents in your own Google Drive. Dhandha files them in a &quot;Dhandha – {tenant.name}&quot; folder, one sub-folder per company, and can only see files it put there.</p></div></div>
      {sp?.connected && <p className="notice info small">Google Drive is connected.</p>}
      {sp?.error && <p className="notice bad small">{ERRORS[sp.error] || "Something went wrong."}</p>}
      <div className="panel stack-sm" style={{ maxWidth: 620 }}>
        <div className="kpi-label">Status</div>
        <div className="kpi" style={{ fontSize: 22 }}>{on ? `Connected · ${c.google_email}` : c?.revoked_at ? "Disconnected" : "Not connected"}</div>
        {on && <p className="small muted" style={{ margin: 0 }}>Since {fmtDate(c.connected_at)}.</p>}
        {!driveReady() && <p className="small muted" style={{ margin: 0 }}>Google sign-in is being switched on for Dhandha.</p>}
        {isAdmin ? (
          <div className="row">
            <a className={`btn ${on ? "ghost" : "gold"}`} href="/api/google/start" aria-disabled={!driveReady()}>{on ? "Connect a different Google account" : "Connect Google Drive"}</a>
            {on && <form action={disconnectDrive}><button className="danger">Disconnect</button></form>}
          </div>
        ) : <p className="small muted" style={{ margin: 0 }}>Only the workspace admin can connect or disconnect.</p>}
        <p className="tiny faint" style={{ margin: 0 }}>Disconnecting stops new uploads; files already in your Drive stay there and links in the Vault keep working for people you share them with. To remove Dhandha completely, also visit myaccount.google.com/permissions.</p>
      </div>
    </div>
  );
}
