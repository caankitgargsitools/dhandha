import { NextResponse } from "next/server";
import { getContext } from "@/lib/session";
import { exchangeCode, emailFromIdToken, encryptToken, ensureFolder } from "@/lib/google";

export async function GET(request) {
  const url = new URL(request.url);
  const back = (q) => {
    const res = NextResponse.redirect(`${url.origin}/app/settings/drive?${q}`);
    res.cookies.delete({ name: "dh_gstate", path: "/api/google" });
    return res;
  };
  const state = url.searchParams.get("state");
  if (!state || state !== request.cookies.get("dh_gstate")?.value) return back("error=state");
  if (url.searchParams.get("error")) return back("error=denied");
  const { supabase, tenant, isAdmin } = await getContext();
  if (!isAdmin) return back("error=admin_only");
  try {
    const t = await exchangeCode(url.searchParams.get("code"), `${url.origin}/api/google/callback`);
    if (!t.refresh_token) return back("error=no_refresh");
    if (!String(t.scope || "").includes("drive.file")) return back("error=scope");
    const root = await ensureFolder(t.access_token, `Dhandha – ${tenant.name}`.slice(0, 100));
    const { error } = await supabase.rpc("save_drive_connection", { p_tenant: tenant.id, p_email: emailFromIdToken(t.id_token) || "", p_token_enc: encryptToken(t.refresh_token), p_root: root });
    if (error) return back("error=save");
    return back("connected=1");
  } catch (e) {
    console.error("google callback", e.message);
    return back("error=google");
  }
}
