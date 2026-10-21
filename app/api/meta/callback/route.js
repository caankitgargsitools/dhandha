import { NextResponse } from "next/server";
import { getContext } from "@/lib/session";
import { pagesFromCode, subscribePage } from "@/lib/meta";

// Connects every Page the admin picked on Facebook's screen to the company that is open in Dhandha.
export async function GET(request) {
  const url = new URL(request.url);
  const back = (q) => {
    const res = NextResponse.redirect(`${url.origin}/app/settings/facebook?${q}`);
    res.cookies.delete({ name: "dh_mstate", path: "/api/meta" });
    return res;
  };
  const state = url.searchParams.get("state");
  if (!state || state !== request.cookies.get("dh_mstate")?.value) return back("error=state");
  if (url.searchParams.get("error")) return back("error=denied");
  const { supabase, company, isAdmin } = await getContext();
  if (!isAdmin) return back("error=admin_only");
  try {
    const pages = await pagesFromCode(url.searchParams.get("code"), `${url.origin}/api/meta/callback`);
    if (!pages.length) return back("error=no_pages");
    const ok = [];
    for (const p of pages) { try { await subscribePage(p.id, p.token); ok.push(p); } catch (e) { console.error("meta subscribe", p.id, e.message); } }
    if (!ok.length) return back("error=subscribe");
    const { error } = await supabase.rpc("save_meta_pages", { p_company: company.id, p_pages: ok });
    if (error) return back(`error=save&m=${encodeURIComponent(error.message.slice(0, 120))}`);
    return back(`connected=${ok.length}`);
  } catch (e) {
    console.error("meta callback", e.message);
    return back("error=meta");
  }
}
