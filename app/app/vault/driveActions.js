"use server";
import { headers } from "next/headers";
import { getContext } from "@/lib/session";
import { companyDrive } from "@/lib/drive";
import { createUploadSession, getFile } from "@/lib/google";

// Step 1: a resumable upload session in the company's Drive folder; the browser sends the file straight to Google.
export async function startDriveUpload({ name, type, size }) {
  const ctx = await getContext();
  if (ctx.role === "viewer") return { error: "Viewers cannot upload." };
  if (!(size > 0) || size > 200 * 1024 * 1024) return { error: "Files up to 200 MB." };
  try {
    const { access, folderId } = await companyDrive(ctx);
    const h = await headers();
    const origin = h.get("origin") || `https://${h.get("host")}`;
    const uploadUrl = await createUploadSession(access, { name: String(name).slice(0, 200), mimeType: String(type || "application/octet-stream"), size, parentId: folderId, origin });
    return { uploadUrl };
  } catch (e) {
    return { error: e.message };
  }
}

// Step 2: confirm the file landed in this company's folder and return its Drive link.
export async function finishDriveUpload(fileId) {
  const ctx = await getContext();
  try {
    const { access, folderId } = await companyDrive(ctx);
    const f = await getFile(access, String(fileId));
    if (f.trashed || !(f.parents || []).includes(folderId)) return { error: "That file is not in this company's Drive folder." };
    return { id: f.id, url: f.webViewLink, name: f.name };
  } catch (e) {
    return { error: e.message };
  }
}
