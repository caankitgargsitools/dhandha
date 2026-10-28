import { headers } from "next/headers";
import { getContext, fmtDate } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";
import { TOOLS } from "@/lib/mcp";
import NewKey from "./NewKey";
import { revokeMcpKey } from "./actions";

export const metadata = { title: "AI assistants" };

export default async function Assistants() {
  const { supabase, company, role } = await getContext();
  const h = await headers();
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : `${h.get("x-forwarded-proto") || "https"}://${h.get("host")}`;
  const endpoint = `${origin}/api/mcp`;
  const isLead = ["admin", "manager"].includes(role);
  const { data: keys } = isLead ? await supabase.from("mcp_keys").select("id, name, prefix, can_write, created_at, last_used_at, uses").eq("company_id", company.id).is("revoked_at", null).order("created_at") : { data: [] };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>AI assistants</h1>
          <p>Connect Claude, ChatGPT, Gemini or any assistant that supports MCP to Dhandha, then just ask: &ldquo;Which audit tenders close this week?&rdquo;, &ldquo;Who won road work in Gurugram last year and for how much?&rdquo;, &ldquo;Add Sharma Traders, 98100 12345, as a lead&rdquo;.</p>
        </div>
      </div>
      {!isLead ? <div className="notice">Only admins and managers can connect AI assistants.</div> : (
        <div className="grid-2" style={{ alignItems: "start" }}>
          <div className="stack">
            <div className="panel stack-sm">
              <h3 style={{ margin: 0 }}>New connection</h3>
              <NewKey endpoint={endpoint} />
            </div>
            <div className="panel flush table-wrap">
              <table>
                <thead><tr><th>Assistant</th><th>Can</th><th>Used</th><th /></tr></thead>
                <tbody>
                  {!(keys || []).length && <tr><td colSpan={4} className="muted small" style={{ padding: 18 }}>No assistants connected yet.</td></tr>}
                  {(keys || []).map((k) => (
                    <tr key={k.id}>
                      <td><strong>{k.name}</strong><div className="tiny faint num">{k.prefix}… · made {fmtDate(k.created_at)}</div></td>
                      <td className="small">{k.can_write ? "Read + add leads" : "Read only"}</td>
                      <td className="small">{k.uses ? <>{k.uses} calls<div className="tiny faint">last {fmtDate(k.last_used_at)}</div></> : "Not yet"}</td>
                      <td><form action={revokeMcpKey}><input type="hidden" name="id" value={k.id} /><SubmitButton className="ghost sm" confirm="Disconnect this assistant? Its key stops working at once.">Disconnect</SubmitButton></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="stack">
            <div className="panel">
              <h3>How to connect</h3>
              <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                <li><strong>Claude</strong> (claude.ai or the app): Settings → Connectors → Add custom connector → paste the address with key.</li>
                <li><strong>ChatGPT</strong>: Settings → Apps &amp; Connectors → Advanced → Developer mode on → Create → paste the address with key, authentication &ldquo;No authentication&rdquo;.</li>
                <li><strong>Claude Code / Gemini CLI / Cursor</strong>: add an HTTP MCP server with the address and the header <code>Authorization: Bearer &lt;key&gt;</code> (Claude Code: copy the ready command).</li>
              </ol>
              <p className="tiny faint" style={{ marginBottom: 0 }}>Each key sees only {company.legal_name || "this company"}. The assistant&apos;s maker (Anthropic, OpenAI, Google) receives what the assistant reads, under your own account with them. Free in Dhandha; at most 60 calls a minute per key. Disconnect any time.</p>
            </div>
            <div className="panel">
              <h3>What the assistant can do</h3>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
                {TOOLS.map((t) => <li key={t.name}><strong>{t.title}</strong> — {t.description}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
