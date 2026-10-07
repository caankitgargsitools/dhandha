import { getContext } from "@/lib/session";
import BrandUploader from "./BrandUploader";

const KINDS = [
  { kind: "letterhead", title: "Letterhead", help: "A blank letterhead page as PDF or image (A4). Pages marked “on letterhead” are printed inside it.", accept: "application/pdf,image/png,image/jpeg", clean: false, margins: true },
  { kind: "signature", title: "Signature", help: "Sign on plain white paper and take a clear photo. The white background is removed automatically.", accept: "image/png,image/jpeg", clean: true, secret: true },
  { kind: "seal", title: "Company seal / stamp", help: "Stamp on white paper and photograph it. The background is removed automatically.", accept: "image/png,image/jpeg", clean: true, secret: true },
  { kind: "logo", title: "Logo", help: "Used on proposals, posts and videos. PNG with transparent background is best.", accept: "image/png,image/jpeg,image/webp", clean: false },
];

export default async function Brand() {
  const { supabase, tenant, company, isAdmin, has2fa, role } = await getContext();
  const { data: assets } = await supabase.from("brand_assets").select("*").eq("company_id", company.id);
  const canView = ["admin", "manager", "bid_preparer"].includes(role);
  const previews = {};
  for (const a of assets || []) {
    if (!canView) continue;
    const { data } = await supabase.storage.from("brand").createSignedUrl(a.storage_path, 120);
    previews[a.kind] = { url: data?.signedUrl, path: a.storage_path, meta: a.meta, at: a.created_at };
  }
  const { data: uses } = await supabase.from("signature_uses").select("*").eq("company_id", company.id).order("used_at", { ascending: false }).limit(10);

  return (
    <div className="stack">
      <div>
        <h1>Letterhead & signature</h1>
        <p className="muted" style={{ margin: 0 }}>
          Stored privately for this company. The signature and seal are placed only on documents Dhandha generates, only after an OTP
          approval by the signatory, and every use is logged below.
        </p>
      </div>
      {!isAdmin && <p className="notice small">Only an admin can change these.</p>}
      <div className="grid">
        {KINDS.map((k) => (
          <div key={k.kind} className="panel stack">
            <h3>{k.title}</h3>
            <p className="muted small" style={{ margin: 0 }}>{k.help}</p>
            {previews[k.kind]?.url ? (
              previews[k.kind].path.endsWith(".pdf") ? (
                <a href={previews[k.kind].url} target="_blank" rel="noreferrer">View current PDF</a>
              ) : (
                <div style={{ background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0/16px 16px", borderRadius: 8, padding: 8, textAlign: "center" }}>
                  <img src={previews[k.kind].url} alt={k.title} style={{ maxWidth: "100%", maxHeight: 140 }} />
                </div>
              )
            ) : (
              <span className="chip warn" style={{ alignSelf: "start" }}>Not uploaded</span>
            )}
            {isAdmin && (
              k.secret && !has2fa ? (
                <p className="error small">Turn on two-factor login (Security) before uploading.</p>
              ) : (
                <BrandUploader tenantId={tenant.id} companyId={company.id} kind={k.kind} accept={k.accept} clean={k.clean}
                  margins={k.margins} current={previews[k.kind]?.meta} />
              )
            )}
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Signature use log</h3>
        {!uses?.length ? <p className="muted small">Not used yet. Each bid document signed by Dhandha will appear here with its OTP reference.</p> : (
          <table>
            <thead><tr><th>When</th><th>Document</th><th>Context</th><th>OTP ref</th></tr></thead>
            <tbody>{uses.map((u) => (
              <tr key={u.id}><td className="small">{new Date(u.used_at).toLocaleString("en-IN")}</td><td>{u.document_label}</td><td>{u.context || "—"}</td><td className="small">{u.otp_ref || "—"}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
