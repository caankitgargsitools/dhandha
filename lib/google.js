// Google Drive for each workspace: OAuth with only the drive.file scope (Dhandha can see just the files it
// creates), refresh token encrypted at rest, uploads straight from the browser through resumable sessions.
// Env (Vercel): GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const DRIVE_SCOPES = "openid email https://www.googleapis.com/auth/drive.file";
export const driveReady = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const b64u = (b) => Buffer.from(b).toString("base64url");
const keyFrom = (secret) => createHash("sha256").update(`${secret}:dhandha-drive-v1`).digest();

// AES-256-GCM: "iv.tag.ciphertext", all base64url. The key comes from the Google client secret, which only the server has.
export function encryptToken(plain, secret = process.env.GOOGLE_CLIENT_SECRET) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const ct = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return `${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(ct)}`;
}

export function decryptToken(enc, secret = process.env.GOOGLE_CLIENT_SECRET) {
  const [iv, tag, ct] = String(enc || "").split(".").map((x) => Buffer.from(x, "base64url"));
  if (!iv?.length || !tag?.length || !ct) throw new Error("Drive connection is damaged; reconnect Google Drive");
  const d = createDecipheriv("aes-256-gcm", keyFrom(secret), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

export function authUrl({ clientId = process.env.GOOGLE_CLIENT_ID, redirectUri, state, loginHint }) {
  const p = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: DRIVE_SCOPES,
    access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// The id_token comes straight from Google's token endpoint over TLS, so only its payload is read.
export function emailFromIdToken(idToken) {
  try { return JSON.parse(Buffer.from(String(idToken).split(".")[1], "base64url").toString("utf8")).email || null; } catch { return null; }
}

async function tokenCall(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, ...params }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error === "invalid_grant" ? "Google access was removed or expired; reconnect Google Drive" : data.error_description || data.error || `Google error ${r.status}`);
  return data;
}

export const exchangeCode = (code, redirectUri) => tokenCall({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
export const accessToken = async (refreshToken) => (await tokenCall({ grant_type: "refresh_token", refresh_token: refreshToken })).access_token;

async function api(access, path, init = {}) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${path}`, { ...init, headers: { authorization: `Bearer ${access}`, "content-type": "application/json", ...(init.headers || {}) } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `Drive error ${r.status}`);
  return data;
}

const q = (s) => String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

// Finds (among files Dhandha created) or creates a folder.
export async function ensureFolder(access, name, parentId) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${q(name)}' and trashed=false${parentId ? ` and '${q(parentId)}' in parents` : ""}`;
  const found = await api(access, `files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  if (found.files?.[0]) return found.files[0].id;
  const made = await api(access, "files?fields=id", { method: "POST", body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }) });
  return made.id;
}

// A resumable upload session the browser can PUT the file to directly (CORS is allowed for the given origin).
export async function createUploadSession(access, { name, mimeType, size, parentId, origin }) {
  const r = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink,parents", {
    method: "POST",
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json; charset=UTF-8", "x-upload-content-type": mimeType || "application/octet-stream", "x-upload-content-length": String(size), origin },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  if (!r.ok) throw new Error(`Drive upload could not start (${r.status})`);
  return r.headers.get("location");
}

export const getFile = (access, id) => api(access, `files/${encodeURIComponent(id)}?fields=id,name,webViewLink,mimeType,size,parents,trashed`);
