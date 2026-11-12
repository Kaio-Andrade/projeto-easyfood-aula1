const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { randomBytes, randomUUID } = require("node:crypto");
const path = require("node:path");

require("dotenv").config({ path: path.resolve(__dirname, "../../.env"), quiet: true });

test("API com PostgreSQL e processamento real de imagens", {
  skip: process.env.RUN_INTEGRATION_TESTS !== "1",
  timeout: 60_000
}, async (t) => {
  process.env.JWT_SECRET ||= randomBytes(32).toString("hex");
  process.env.EMAIL_ENABLED = "false";

  const prisma = require("../../src/database/prisma");
  const sharp = require("sharp");
  const imageService = require("../../src/modules/shared/image.service");
  const runId = randomUUID();
  const ownerEmail = `integration-owner-${runId}@easyfood.test`;
  const guestEmail = `integration-guest-${runId}@easyfood.test`;
  const password = `integration-password-${runId}`;
  const images = new Set();
  let server;
  let baseUrl;
  let owner;
  let guest;
  let ownerToken;
  let guestToken;
  let restaurant;
  let dish;
  let dishImage;

  async function request(endpoint, { method = "GET", body, token, expected = 200 } = {}) {
    const headers = {};
    const multipart = body instanceof FormData;
    if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${endpoint}: ${text}`);
    return text ? JSON.parse(text) : null;
  }

  function imageForm(buffer, type = "image/png") {
    const form = new FormData();
    form.append("image", new Blob([buffer], { type }), "integration.png");
    return form;
  }

  async function checkPublicImage(imageUrl) {
    images.add(imageUrl);
    const response = await fetch(`${baseUrl}${imageUrl}`, { signal: AbortSignal.timeout(10_000) });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^image\/webp/);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 1200);
    assert.ok(metadata.height <= 1200);
  }

  function activityFilters(users, restaurants) {
    return [
      ...users.map((user) => ({ details: `Imagem atualizada para usuário ${user.id}` })),
      ...restaurants.flatMap((item) => [
        { details: `Restaurante ${item.id} criado pelo usuário ${item.ownerId}` },
        { details: { endsWith: ` do restaurante ${item.id}; usuário ${item.ownerId}` } }
      ])
    ];
  }

  async function cleanup() {
    // UUIDs e IDs desta execução limitam a limpeza, inclusive se uma asserção falhar.
    const users = await prisma.user.findMany({ where: { email: { in: [ownerEmail, guestEmail] } } });
    if (!users.length) return;
    const userIds = users.map((user) => user.id);
    const restaurants = await prisma.restaurant.findMany({ where: { ownerId: { in: userIds } } });
    const restaurantIds = restaurants.map((item) => item.id);
    const dishes = await prisma.dish.findMany({ where: { restaurantId: { in: restaurantIds } } });
    for (const item of [...users, ...dishes]) {
      if (item.imageUrl) images.add(item.imageUrl);
    }
    for (const imageUrl of images) await imageService.removeStoredImage(imageUrl);
    await prisma.activity.deleteMany({ where: { OR: activityFilters(users, restaurants) } });
    await prisma.dish.deleteMany({ where: { restaurantId: { in: restaurantIds } } });
    await prisma.restaurant.deleteMany({ where: { id: { in: restaurantIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  try {
    await prisma.$connect();
    server = require("../../src/app").listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    const png = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "#c64422" }
    }).png().toBuffer();

    await t.test("health confirma disponibilidade com banco real", async () => {
      await request("/health");
    });

    await t.test("cadastro normaliza e-mail e impede duplicação com caixa diferente", async () => {
      owner = await request("/auth/register", {
        method: "POST", expected: 201,
        body: { name: "Proprietário integração", email: ownerEmail.toUpperCase(), password }
      });
      assert.equal(owner.email, ownerEmail);
      await request("/auth/register", {
        method: "POST", expected: 409,
        body: { name: "Cadastro duplicado", email: ownerEmail, password }
      });
      guest = await request("/auth/register", {
        method: "POST", expected: 201,
        body: { name: "Visitante integração", email: guestEmail, password }
      });
    });
    assert.ok(owner?.id && guest?.id, "Usuários de integração devem ter sido cadastrados");

    await t.test("login, perfil e autenticação usam usuários persistidos", async () => {
      const ownerLogin = await request("/auth/login", {
        method: "POST", body: { email: ownerEmail.toUpperCase(), password }
      });
      const guestLogin = await request("/auth/login", {
        method: "POST", body: { email: guestEmail, password }
      });
      ownerToken = ownerLogin.token;
      guestToken = guestLogin.token;
      assert.ok(ownerToken && guestToken);
      const me = await request("/auth/me", { token: ownerToken });
      assert.equal(me.user.id, owner.id);
      assert.equal(me.user.password, undefined);
      await request("/auth/me", { expected: 401 });
    });
    assert.ok(ownerToken && guestToken, "Tokens devem ter sido emitidos");

    await t.test("restaurante é criado com seu proprietário e e-mail desativado", async () => {
      const body = { name: `Integração ${runId}`, category: "Brasileira", rating: 4.5 };
      await request("/restaurants", { method: "POST", body, expected: 401 });
      restaurant = await request("/restaurants", { method: "POST", token: ownerToken, body, expected: 201 });
      assert.equal(restaurant.ownerId, owner.id);
      const list = await request("/restaurants");
      assert.ok(list.some((item) => item.id === restaurant.id));
    });
    assert.ok(restaurant?.id, "Restaurante de integração deve existir");

    await t.test("preço com fração de centavo é rejeitado sem criar prato", async () => {
      const before = await prisma.dish.count({ where: { restaurantId: restaurant.id } });
      await request(`/restaurants/${restaurant.id}/dishes`, {
        method: "POST", token: ownerToken, expected: 400,
        body: { name: "Preço inválido", category: "Almoço", description: "Regressão do preço zero", price: 0.001 }
      });
      assert.equal(await prisma.dish.count({ where: { restaurantId: restaurant.id } }), before);
    });

    await t.test("criação, consulta e edição de prato preservam regras de proprietário", async () => {
      const body = { name: "Prato integração", category: "Almoço", description: "Descrição original", price: "25.50" };
      await request(`/restaurants/${restaurant.id}/dishes`, { method: "POST", token: guestToken, body, expected: 403 });
      dish = await request(`/restaurants/${restaurant.id}/dishes`, { method: "POST", token: ownerToken, body, expected: 201 });
      assert.equal(dish.restaurantId, restaurant.id);
      assert.equal(Number(dish.price), 25.5);
      const list = await request(`/restaurants/${restaurant.id}/dishes`);
      assert.ok(list.some((item) => item.id === dish.id));
      assert.equal((await request(`/dishes/${dish.id}`)).id, dish.id);
      const update = { ...body, name: "Prato atualizado", description: "Descrição atualizada", price: "27.90" };
      await request(`/dishes/${dish.id}`, { method: "PUT", token: guestToken, body: update, expected: 403 });
      await request(`/dishes/${dish.id}`, { method: "DELETE", token: guestToken, expected: 403 });
      const updated = await request(`/dishes/${dish.id}`, { method: "PUT", token: ownerToken, body: update });
      assert.equal(updated.name, update.name);
      assert.equal(Number(updated.price), 27.9);
    });
    assert.ok(dish?.id, "Prato de integração deve existir");

    await t.test("imagem real vira WebP público e conteúdo falso é rejeitado", async () => {
      await request(`/dishes/${dish.id}/image`, {
        method: "POST", token: guestToken, body: imageForm(png), expected: 403
      });
      const uploaded = await request(`/dishes/${dish.id}/image`, {
        method: "POST", token: ownerToken, body: imageForm(png)
      });
      dishImage = uploaded.imageUrl;
      await checkPublicImage(dishImage);
      await request(`/dishes/${dish.id}/image`, {
        method: "POST", token: ownerToken, body: imageForm(Buffer.from("não é uma imagem")), expected: 400
      });
      await request(`/dishes/${dish.id}/image`, {
        method: "POST", token: ownerToken, body: imageForm(png, "application/pdf"), expected: 400
      });
      assert.equal((await prisma.dish.findUnique({ where: { id: dish.id } })).imageUrl, dishImage);
    });

    await t.test("imagem de perfil é processada e atividades são persistidas", async () => {
      const uploaded = await request("/auth/me/image", {
        method: "POST", token: ownerToken, body: imageForm(png)
      });
      assert.equal(uploaded.user.id, owner.id);
      await checkPublicImage(uploaded.user.imageUrl);
      assert.equal((await request("/auth/me", { token: ownerToken })).user.imageUrl, uploaded.user.imageUrl);
      const activities = await prisma.activity.findMany({ where: { OR: activityFilters([owner], [restaurant]) } });
      for (const action of ["RESTAURANT_CREATED", "DISH_CREATED", "DISH_UPDATED", "DISH_IMAGE_UPDATED", "PROFILE_IMAGE_UPDATED"]) {
        assert.ok(activities.some((item) => item.action === action), `Atividade ${action} deve existir no PostgreSQL`);
      }
    });

    await t.test("exclusão remove prato e seu arquivo de imagem", async () => {
      await request(`/dishes/${dish.id}`, { method: "DELETE", token: ownerToken, expected: 204 });
      await request(`/dishes/${dish.id}`, { expected: 404 });
      if (dishImage) {
        const response = await fetch(`${baseUrl}${dishImage}`, { signal: AbortSignal.timeout(10_000) });
        await response.arrayBuffer();
        assert.equal(response.status, 404);
      }
      assert.equal(await prisma.dish.count({ where: { restaurantId: restaurant.id } }), 0);
    });
  } finally {
    try {
      await cleanup();
    } finally {
      await Promise.all([
        prisma.$disconnect(),
        server ? new Promise((resolve, reject) => {
          server.close((error) => error ? reject(error) : resolve());
        }) : Promise.resolve()
      ]);
    }
  }
});
