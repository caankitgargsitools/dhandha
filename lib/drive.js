import "server-only";
import { decryptToken, accessToken, ensureFolder } from "./google";

// An access token and the current company's folder in the workspace's connected Drive (creating the folder once).
export async function companyDrive({ supabase, tenant, company }) {
  const { data: conn } = await supabase.from("drive_connections").select("token_enc, root_folder_id, revoked_at").eq("tenant_id", tenant.id).maybeSingle();
  if (!conn?.token_enc || conn.revoked_at) throw new Error("Connect Google Drive first (Settings → Google Drive).");
  const access = await accessToken(decryptToken(conn.token_enc));
  const { data: f } = await supabase.from("company_drive_folders").select("folder_id, root_folder_id").eq("company_id", company.id).maybeSingle();
  if (f && f.root_folder_id === conn.root_folder_id) return { access, folderId: f.folder_id, rootId: conn.root_folder_id };
  const folderId = await ensureFolder(access, company.legal_name.slice(0, 100), conn.root_folder_id);
  await supabase.from("company_drive_folders").upsert({ company_id: company.id, tenant_id: tenant.id, root_folder_id: conn.root_folder_id, folder_id: folderId });
  return { access, folderId, rootId: conn.root_folder_id };
}
