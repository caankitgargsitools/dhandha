// Which portals Dhandha's document fetcher can open (brief §3.10): GeM and the GePNIC portals not marked skip in
// crawler/src/sources.js. For the rest the assistant says so up front and asks for an upload instead of a failed fetch.
import { GEPNIC } from "../crawler/src/sources.js";

const OK = new Set(GEPNIC.filter((s) => !s.skip).map((s) => s.portal));
export const canFetchDocs = (portal) => /^gem$/i.test(String(portal || "")) || OK.has(String(portal || ""));
