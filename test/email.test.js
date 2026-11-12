const { test, after } = require("node:test");
const assert = require("node:assert/strict");

const keys = ["EMAIL_ENABLED", "EMAIL_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"];
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
after(() => {
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});
const calls = [];
let providerError;
const resendPath = require.resolve("resend");
require.cache[resendPath] = {
  id: resendPath, filename: resendPath, loaded: true,
  exports: {
    Resend: class {
      constructor(key) {
        this.emails = { async send(payload, options) { calls.push({ key, payload, options }); return { error: providerError }; } };
      }
    }
  }
};
const { sendEmail, validateEmailConfig, escapeHtml } = require("../src/modules/shared/email.service");
const message = { to: "pessoa@example.com", toName: "Pessoa", subject: "Bem-vindo", header: "<Olá>", body: "Corpo<br/>Mensagem", footer: "Equipe" };

test("e-mail desativado dispensa credenciais e não chama o provedor", async () => {
  process.env.EMAIL_ENABLED = "false";
  delete process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_FROM;
  assert.deepEqual(await sendEmail(message), { skipped: true });
  assert.equal(calls.length, 0);
});

test("ativar e-mail exige configurações válidas", () => {
  process.env.EMAIL_ENABLED = "true";
  assert.throws(validateEmailConfig, /EMAIL_API_KEY e EMAIL_FROM/);
  process.env.EMAIL_API_KEY = "test-key";
  process.env.EMAIL_FROM = "invalid";
  assert.throws(validateEmailConfig, /EMAIL_FROM válido/);
  process.env.EMAIL_FROM = "notifications@example.com";
  process.env.EMAIL_FROM_NAME = "EasyFood";
  assert.equal(validateEmailConfig().from, "notifications@example.com");
  process.env.EMAIL_ENABLED = "yes";
  assert.throws(validateEmailConfig, /true ou false/);
});

test("envio configura Resend e propaga erro do provedor", async () => {
  process.env.EMAIL_ENABLED = "true";
  assert.deepEqual(await sendEmail(message), { skipped: false });
  assert.equal(calls[0].key, "test-key");
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].payload.from, "EasyFood <notifications@example.com>");
  assert.deepEqual(calls[0].payload.to, [message.to]);
  assert.match(calls[0].payload.html, /&lt;Olá&gt;/);
  assert.match(calls[0].payload.text, /Corpo\nMensagem/);
  assert.equal(escapeHtml('<>&"\''), "&lt;&gt;&amp;&quot;&#39;");
  providerError = { message: "Remetente não verificado" };
  await assert.rejects(sendEmail(message), /Remetente não verificado/);
});
