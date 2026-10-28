import { notFound } from "next/navigation";
import { getContext } from "./session";

// Only platform admins (the Dhandha team) may use /admin. Others get a 404.
export async function getAdminContext() {
  const ctx = await getContext({ next: "/admin" });
  if (!ctx.isPlatformAdmin) notFound();
  return ctx;
}
