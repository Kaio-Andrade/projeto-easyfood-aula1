const { Resend } = require("resend");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function buildHtml({ header, body, footer }) {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto"><h2>${escapeHtml(header)}</h2><div>${body}</div><hr/><p style="color:#888;font-size:12px">${escapeHtml(footer)}</p></div>`;
}

function validateEmailConfig() {
  const { EMAIL_ENABLED = "false", EMAIL_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME = "EasyFood" } = process.env;
  if (EMAIL_ENABLED !== "true" && EMAIL_ENABLED !== "false") {
    throw new Error("EMAIL_ENABLED deve ser true ou false");
  }
  if (EMAIL_ENABLED === "false") return null;
  if (!EMAIL_API_KEY?.trim() || !EMAIL_FROM?.trim()) {
    throw new Error("Configure EMAIL_API_KEY e EMAIL_FROM para habilitar o envio de e-mails");
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(EMAIL_FROM) || /[\r\n<>]/.test(EMAIL_FROM_NAME)) {
    throw new Error("Configure um EMAIL_FROM válido e um EMAIL_FROM_NAME sem quebras de linha ou delimitadores");
  }
  return { key: EMAIL_API_KEY, from: EMAIL_FROM, name: EMAIL_FROM_NAME };
}

async function sendEmail({ to, toName, subject, header, body, footer }) {
  const config = validateEmailConfig();
  if (!config) return { skipped: true };

  const resend = new Resend(config.key);
  const { error } = await resend.emails.send({
    from: `${config.name} <${config.from}>`,
    to: [to],
    subject,
    html: buildHtml({ header, body, footer }),
    text: `${header}\n\n${body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")}\n\n${footer}`
  }, { signal: AbortSignal.timeout(10_000) });
  if (error) throw new Error(error.message || "Falha ao enviar e-mail");
  console.log(`[EMAIL] Enviado para ${toName || to} - "${subject}"`);
  return { skipped: false };
}

module.exports = { sendEmail, escapeHtml, validateEmailConfig };
