const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");

process.env.JWT_SECRET = "app-test-secret-with-at-least-32-characters";
let databaseAvailable = true;
const prismaPath = require.resolve("../src/database/prisma");
require.cache[prismaPath] = {
  id: prismaPath, filename: prismaPath, loaded: true,
  exports: {
    async $queryRaw() {
      if (!databaseAvailable) throw new Error("Internal database details must not be exposed");
      return [{ result: 1 }];
    }
  }
};
let server;
let base;
before(async () => {
  server = require("../src/app").listen(0, "127.0.0.1");
  await once(server, "listening");
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));

test("health distingue banco disponível de indisponível sem expor detalhes", async () => {
  let response = await fetch(`${base}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  databaseAvailable = false;
  response = await fetch(`${base}/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: "unavailable" });
  databaseAvailable = true;
});

test("JSON malformado e corpo excessivo retornam erros de entrada em JSON", async () => {
  const malformed = await fetch(`${base}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: '{"name":'
  });
  assert.equal(malformed.status, 400);
  assert.match((await malformed.json()).error, /JSON válido/);
  const tooLarge = await fetch(`${base}/auth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "a".repeat(110_000) })
  });
  assert.equal(tooLarge.status, 413);
  assert.match((await tooLarge.json()).error, /tamanho/);
});
