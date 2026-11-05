// "File it" (brief §3.2): the upload kit for a bid — every document the tender asks for, matched to the Vault copy
// (missing / expired / expires before the bid closes), the signed bid file, a DSC check, and the person's own ticks
// as each one is uploaded on the portal. Pure and tested.

const day = (d) => (d ? String(d).slice(0, 10) : null);

// required: document type codes; docs: Vault documents [{id, type_code, title, valid_until, storage_path, drive_url}];
// docTypes: [{code, name}]; dueAt: closing; packs: [{kind}]; ticks: {slotKey: iso}
export function filingKit({ required = [], docs = [], docTypes = [], dueAt = null, packs = [], ticks = {}, now = new Date() } = {}) {
  const name = (code) => docTypes.find((t) => t.code === code)?.name || code;
  const close = dueAt ? new Date(dueAt) : null;
  const slots = [];
  // the bid file Dhandha made (signed) goes first: it holds the covering letter and every format
  const signed = packs.some((p) => p.kind === "final");
  slots.push({ key: "pack", label: "Signed bid file (covering letter, formats, checklist)", kind: "pack", state: signed ? "ready" : packs.length ? "draft" : "missing", ticked: !!ticks.pack });
  let dsc = null;
  for (const code of [...new Set(required)]) {
    const have = docs.filter((d) => d.type_code === code).sort((a, b) => String(b.valid_until || "9999").localeCompare(String(a.valid_until || "9999")))[0];
    const exp = have?.valid_until ? new Date(have.valid_until) : null;
    const state = !have ? "missing" : exp && exp < now ? "expired" : exp && close && exp < close ? "expires_before_close" : "ready";
    if (code === "DSC") { // a signing token, not an attachment: only its validity matters
      dsc = { state, valid_until: day(have?.valid_until), doc: have || null };
      continue;
    }
    slots.push({ key: `doc:${code}`, code, label: name(code), kind: "doc", doc: have || null, state, valid_until: day(have?.valid_until), ticked: !!ticks[`doc:${code}`] });
  }
  const uploads = slots.filter((s) => s.state !== "missing");
  return {
    slots, dsc,
    missing: slots.filter((s) => s.state === "missing" || s.state === "expired").length,
    ticked: slots.filter((s) => s.ticked).length,
    ready: slots.length > 0 && slots.every((s) => s.ticked || s.state === "missing") && uploads.every((s) => s.ticked),
  };
}

// The deposit to record when the bid is filed: EMD from the tender, exempt for an MSE when the tender allows it.
export function emdOnFiling({ emd = null, msme = false, mseExempt = false, mode = "online", reference = null } = {}) {
  const amount = Number(emd) || 0;
  if (!amount) return null;
  if (msme && mseExempt) return { kind: "emd", amount, mode: "exempt", status: "exempt", note: "MSE exemption claimed (Udyam)" };
  return { kind: "emd", amount, mode: ["online", "bg", "dd", "fdr", "other"].includes(mode) ? mode : "online", status: "held", reference: reference || null };
}
