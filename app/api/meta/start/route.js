import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getContext } from "@/lib/session";
import { metaAuthUrl, metaReady } from "@/lib/meta";

export async function GET(request) {
  const { isAdmin } = await getContext();
  const origin = new URL(request.url).origin;
  if (!isAdmin || !metaReady()) return NextResponse.redirect(`${origin}/app/settings/facebook?error=${isAdmin ? "not_configured" : "admin_only"}`);
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(metaAuthUrl({ redirectUri: `${origin}/api/meta/callback`, state }));
  res.cookies.set("dh_mstate", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/meta", maxAge: 600 });
  return res;
}
