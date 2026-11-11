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

async function sendEmail({ to, toName, subject, header, body, footer }) {
  const { EMAIL_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME = "EasyFood" } = process.env;
  if (!EMAIL_API_KEY || !EMAIL_FROM) {
    throw new Error("As configurações de e-mail não foram definidas");
  }

  const resend = new Resend(EMAIL_API_KEY);
  const { error } = await resend.emails.send({
    from: `${EMAIL_FROM_NAME} <${EMAIL_FROM}>`,
    to: [to],
    subject,
    html: buildHtml({ header, body, footer }),
    text: `${header}\n\n${body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")}\n\n${footer}`
  });
  if (error) throw new Error(error.message || "Falha ao enviar e-mail");
  console.log(`[EMAIL] Enviado para ${toName || to} - "${subject}"`);
}

module.exports = { sendEmail, escapeHtml };
