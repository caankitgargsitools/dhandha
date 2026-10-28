// Outreach senders. Email goes through Resend (platform key RESEND_API_KEY, sender OUTREACH_FROM_EMAIL in Vercel env);
// WhatsApp goes through each customer's own WhatsApp Business number (Meta Cloud API), approved templates only.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Plain-text body → simple HTML email with the sender's identity and a one-click unsubscribe (required for bulk mail).
export function emailHtml({ body, company, address, unsubUrl }) {
  const paras = String(body || "").trim().split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  return `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1b2240;max-width:620px">${paras}`
    + `<hr style="border:0;border-top:1px solid #e3ddd0;margin:24px 0 10px"><p style="font-size:12px;color:#7a7f95;margin:0">${esc(company)}${address ? `, ${esc(address)}` : ""}<br>`
    + `Not interested? <a href="${esc(unsubUrl)}" style="color:#7a7f95">Unsubscribe</a> and we will not email you again.</p></body></html>`;
}

export function emailText({ body, company, unsubUrl }) {
  return `${String(body || "").trim()}\n\n--\n${company}\nUnsubscribe: ${unsubUrl}\n`;
}

export function whatsappPayload({ to, template, lang, params }) {
  return {
    messaging_product: "whatsapp", to: `91${to}`, type: "template",
    template: { name: template, language: { code: lang || "en" }, components: (params || []).length ? [{ type: "body", parameters: params.map((t) => ({ type: "text", text: String(t).slice(0, 200) })) }] : [] },
  };
}

export const emailReady = () => Boolean(process.env.RESEND_API_KEY && process.env.OUTREACH_FROM_EMAIL);

export async function sendEmail(m, origin) {
  const unsubUrl = `${origin}/u/${m.unsub_token}`;
  const fromName = String(m.from_name || m.company || "Dhandha").replace(/["<>\n\r]/g, "").slice(0, 70);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${process.env.OUTREACH_FROM_EMAIL}>`, to: [m.to], subject: m.subject,
      ...(m.reply_to ? { reply_to: m.reply_to } : {}),
      html: emailHtml({ body: m.body, company: m.company, address: m.company_address, unsubUrl }),
      text: emailText({ body: m.body, company: m.company, unsubUrl }),
      headers: { "List-Unsubscribe": `<${origin}/api/unsubscribe?t=${m.unsub_token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.message || `email provider error ${r.status}`);
  return data.id;
}

export async function sendWhatsApp(m) {
  if (!m.wa_token || !m.wa_phone_number_id) throw new Error("WhatsApp is not connected");
  const r = await fetch(`https://graph.facebook.com/v21.0/${m.wa_phone_number_id}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${m.wa_token}`, "content-type": "application/json" },
    body: JSON.stringify(whatsappPayload({ to: m.to, template: m.wa_template, lang: m.wa_lang, params: m.wa_params })),
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error?.message || `WhatsApp error ${r.status}`);
  return data?.messages?.[0]?.id || "sent";
}
