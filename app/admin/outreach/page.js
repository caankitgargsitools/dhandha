import { getAdminContext } from "@/lib/admin";
import FormState from "@/app/app/FormState";
import Icon from "@/components/Icon";
import { emailReady } from "@/lib/outreach";
import { saveAppUrl } from "../actions";

export default async function AdminOutreach() {
  const { supabase } = await getAdminContext();
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: url }, { data: msgs }] = await Promise.all([
    supabase.rpc("admin_get_app_url"),
    supabase.from("outreach_messages").select("status, channel, error").gte("created_at", since).limit(5000),
  ]);
  const by = (st) => (msgs || []).filter((m) => m.status === st).length;
  const errors = Object.entries((msgs || []).filter((m) => m.error).reduce((a, m) => ({ ...a, [m.error]: (a[m.error] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const checks = [
    [!!url, "Site address saved below", "pg_cron wakes the sender at this address every 5 minutes."],
    [emailReady(), "Email service keys in Vercel", "Create a free Resend account, verify a sending domain (e.g. mail.yourdomain.in), then add RESEND_API_KEY and OUTREACH_FROM_EMAIL (e.g. outreach@mail.yourdomain.in) in Vercel → Environment Variables and redeploy."],
  ];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Outreach</h1><p>Email (Dhandha&apos;s mail service) and WhatsApp (each customer&apos;s own number) sending across all workspaces.</p></div></div>
      <div className="grid-3">
        <div className="panel ledger"><div className="kpi-label">Sent, 7 days</div><div className="kpi">{by("sent")}</div><div className="faint small">{by("queued") + by("sending")} waiting</div></div>
        <div className="panel ledger"><div className="kpi-label">Failed, 7 days</div><div className="kpi" style={{ color: by("failed") ? "var(--blood)" : undefined }}>{by("failed")}</div></div>
        <div className="panel">
          <h3 style={{ fontSize: 15 }}>Switch-on checklist</h3>
          <ul className="reasons">{checks.map(([ok, label, help]) => <li key={label}><Icon name={ok ? "check" : "alert"} size={14} /><span><strong>{label}</strong>{!ok && <div className="tiny faint">{help}</div>}</span></li>)}</ul>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h3>Site address</h3>
          <FormState action={saveAppUrl}>
            <div><label htmlFor="url">Production address</label><input id="url" name="url" defaultValue={url || ""} placeholder="https://dhandha.in" /></div>
          </FormState>
          <p className="tiny faint" style={{ marginBottom: 0 }}>The worker key that proves the call is genuine lives only in Supabase Vault (outreach_worker_key); nothing to copy anywhere.</p>
        </div>
        <div className="panel">
          <h3>Most common errors</h3>
          {!errors.length ? <p className="small muted">None this week.</p> : errors.map(([e, n]) => <div key={e} className="row between small" style={{ padding: "4px 0", borderTop: "1px solid var(--line-soft)" }}><span>{e}</span><strong>{n}</strong></div>)}
        </div>
      </div>
    </div>
  );
}
