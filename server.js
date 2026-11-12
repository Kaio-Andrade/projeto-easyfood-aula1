require("dotenv").config({ quiet: true });

const app = require("./src/app");
const prisma = require("./src/database/prisma");
const { validateEmailConfig } = require("./src/modules/shared/email.service");

const portValue = process.env.PORT || "3000";
if (!/^\d+$/.test(portValue) || Number(portValue) < 1 || Number(portValue) > 65535) {
  throw new Error("PORT deve ser uma porta válida entre 1 e 65535");
}
if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("Configure DATABASE_URL antes de iniciar a aplicação");
}
validateEmailConfig();

const server = app.listen(Number(portValue), "0.0.0.0", () => {
  console.log(`EasyFood rodando na porta ${portValue}`);
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  const timeout = setTimeout(() => process.exit(1), 10_000);
  timeout.unref();
  server.close(async (error) => {
    try {
      await prisma.$disconnect();
      clearTimeout(timeout);
      process.exit(error ? 1 : 0);
    } catch {
      process.exit(1);
    }
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
