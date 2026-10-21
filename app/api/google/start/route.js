import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getContext } from "@/lib/session";
import { authUrl, driveReady } from "@/lib/google";

// Workspace admin → Google consent (drive.file only). A random state in a short-lived cookie guards the callback.
export async function GET(request) {
  const { isAdmin, user } = await getContext();
  const origin = new URL(request.url).origin;
  if (!isAdmin || !driveReady()) return NextResponse.redirect(`${origin}/app/settings/drive?error=${isAdmin ? "not_configured" : "admin_only"}`);
  const state = randomBytes(18).toString("base64url");
  const res = NextResponse.redirect(authUrl({ redirectUri: `${origin}/api/google/callback`, state, loginHint: user.email }));
  res.cookies.set("dh_gstate", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/api/google", maxAge: 600 });
  return res;
}
