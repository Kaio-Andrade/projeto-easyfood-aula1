const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "validation-test-secret-that-is-long-enough";

const users = [];
const restaurants = [{ id: 1, name: "Restaurante", category: "Almoço", ownerId: 1 }];
const dishes = [];
const prismaPath = require.resolve("../src/database/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    user: {
      async create({ data }) {
        if (users.some((user) => user.email === data.email)) {
          throw Object.assign(new Error("Duplicate email"), { code: "P2002" });
        }
        const user = { id: users.length + 1, imageUrl: null, ...data };
        users.push(user);
        return user;
      },
      async findUnique({ where }) {
        return users.find((user) => where.email ? user.email === where.email : user.id === where.id) || null;
      },
      async findFirst({ where, select }) {
        const user = users.find((item) => where.email.mode === "insensitive"
          ? item.email.toLowerCase() === where.email.equals.toLowerCase()
          : item.email === where.email.equals) || null;
        return user && select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
      }
    },
    restaurant: {
      async findMany() { return restaurants; },
      async findUnique({ where }) { return restaurants.find((restaurant) => restaurant.id === where.id) || null; },
      async create({ data }) {
        const restaurant = { id: restaurants.length + 1, ...data };
        restaurants.push(restaurant);
        return restaurant;
      }
    },
    dish: {
      async create({ data }) {
        const dish = { id: dishes.length + 1, imageUrl: null, ...data };
        dishes.push(dish);
        return dish;
      },
      async findUnique({ where }) { return dishes.find((dish) => dish.id === where.id) || null; },
      async findMany({ where }) { return dishes.filter((dish) => dish.restaurantId === where.restaurantId); },
      async update({ where, data }) {
        const dish = dishes.find((item) => item.id === where.id);
        Object.assign(dish, data);
        return dish;
      }
    },
    activity: { async create({ data }) { return { id: 1, ...data }; } }
  }
};

const emailPath = require.resolve("../src/modules/shared/email.service");
require.cache[emailPath] = {
  id: emailPath,
  filename: emailPath,
  loaded: true,
  exports: { async sendEmail() {}, escapeHtml(value) { return String(value); } }
};

const token = jwt.sign({ sub: 1, email: "pessoa@easyfood.test" }, process.env.JWT_SECRET, { expiresIn: "1h" });
let server;
let baseUrl;
before(async () => {
  server = require("../src/app").listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

async function request(path, { method = "POST", body, authenticated = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}

async function badRequest(path, options, label) {
  const result = await request(path, options);
  assert.equal(result.status, 400, `${label}: ${JSON.stringify(result.body)}`);
  assert.equal(typeof result.body.error, "string", label);
}

test("cadastro e login normalizam e-mail e rejeitam dados inválidos com 400", async () => {
  const valid = { name: "  Pessoa Teste  ", email: "  PESSOA@EasyFood.Test  ", password: "senha-forte" };
  const initialUsers = users.length;
  for (const body of [undefined, null, [], {}, { ...valid, name: "  " }, { ...valid, name: 1 },
    { ...valid, name: "x".repeat(151) }, { ...valid, email: "sem-arroba" },
    { ...valid, email: true }, { ...valid, password: "curta" },
    { ...valid, password: true }, { ...valid, password: "a".repeat(73) },
    { ...valid, password: "é".repeat(37) }]) {
    await badRequest("/auth/register", { body }, `cadastro ${JSON.stringify(body)}`);
  }
  assert.equal(users.length, initialUsers, "cadastros inválidos não chegam ao banco");
  const registered = await request("/auth/register", { body: valid });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.name, "Pessoa Teste");
  assert.equal(registered.body.email, "pessoa@easyfood.test");
  const duplicate = await request("/auth/register", { body: { ...valid, email: "pessoa@easyfood.test" } });
  assert.equal(duplicate.status, 409);
  const login = await request("/auth/login", { body: { email: " PESSOA@EASYFOOD.TEST ", password: valid.password } });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.email, "pessoa@easyfood.test");
  for (const body of [undefined, [], { email: true, password: valid.password },
    { email: valid.email, password: {} }, { email: valid.email, password: " " }]) {
    await badRequest("/auth/login", { body }, "login inválido");
  }
});

test("login mantém acesso de contas antigas com senha curta sem permitir novo cadastro com ela", async () => {
  users.push({ id: users.length + 1, name: "Conta antiga", email: "antiga@easyfood.test", password: await bcrypt.hash("curta", 10) });
  const legacy = await request("/auth/login", { body: { email: "antiga@easyfood.test", password: "curta" } });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.body.user.email, "antiga@easyfood.test");
  await badRequest("/auth/register", { body: { name: "Conta nova", email: "nova@easyfood.test", password: "curta" } }, "nova conta com senha curta");
});

test("e-mail legado com maiúsculas permite login e impede cadastro duplicado sem alterar dados existentes", async () => {
  const legacyEmail = "LEGADO@EasyFood.Test";
  const password = "senha-legada";
  users.push({ id: users.length + 1, name: "Conta legada", email: legacyEmail, password: await bcrypt.hash(password, 10) });
  const countBefore = users.length;
  for (const email of ["legado@easyfood.test", " LeGaDo@EASYFOOD.TEST "]) {
    const login = await request("/auth/login", { body: { email, password } });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.email, legacyEmail);
  }
  const duplicate = await request("/auth/register", {
    body: { name: "Outra conta", email: "legado@easyfood.test", password: "outra-senha" }
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "E-mail já cadastrado");
  assert.equal(users.length, countBefore);
  assert.equal(users.at(-1).email, legacyEmail);
});

test("restaurantes validam nome, categoria e avaliação antes de gravar", async () => {
  const valid = { name: "  Restaurante novo ", category: " Brasileira ", rating: "4.5" };
  const initialRestaurants = restaurants.length;
  for (const body of [undefined, [], { ...valid, name: {} }, { ...valid, name: " " },
    { ...valid, category: [] }, { ...valid, category: "x".repeat(101) },
    ...[-1, 5.1, 4.55, "", null, true, [], {}, "0x4", "1e0"].map((rating) => ({ ...valid, rating }))]) {
    await badRequest("/restaurants", { body, authenticated: true }, "restaurante inválido");
  }
  assert.equal(restaurants.length, initialRestaurants);
  const created = await request("/restaurants", { body: valid, authenticated: true });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "Restaurante novo");
  assert.equal(created.body.category, "Brasileira");
  assert.equal(created.body.rating, 4.5);
  const withoutRating = await request("/restaurants", {
    body: { name: "Sem avaliação", category: "Brasileira" }, authenticated: true
  });
  assert.equal(withoutRating.status, 201);
  assert.equal(withoutRating.body.rating, 0);
});

test("preço de prato preserva centavos e rejeita zero, frações extras, tipos e limites inválidos", async () => {
  const valid = { name: " Prato ", category: " Almoço ", description: " Descrição ", price: "25.50" };
  const initialDishes = dishes.length;
  const invalidPrices = [0.001, "0.001", 0, "0.00", -1, 100000000, "100000000.00", true,
    false, [], {}, "", null, undefined, "1e2", "0x10", "1,50", "NaN", "Infinity", "1.999"];
  for (const price of invalidPrices) {
    await badRequest("/restaurants/1/dishes", { body: { ...valid, price }, authenticated: true }, `preço ${JSON.stringify(price)}`);
  }
  for (const body of [undefined, [], { ...valid, description: false },
    { ...valid, name: " " }, { ...valid, description: "x".repeat(1001) }]) {
    await badRequest("/restaurants/1/dishes", { body, authenticated: true }, "prato inválido");
  }
  assert.equal(dishes.length, initialDishes, "nenhum preço inválido foi persistido");
  for (const [price, expected] of [[0.01, "0.01"], ["0.01", "0.01"], [25.5, "25.50"],
    ["99999999.99", "99999999.99"], ["0001.20", "1.20"]]) {
    const created = await request("/restaurants/1/dishes", { body: { ...valid, price }, authenticated: true });
    assert.equal(created.status, 201);
    assert.equal(created.body.price, expected);
    assert.equal(created.body.name, "Prato");
  }
  const first = dishes[initialDishes];
  const previousPrice = first.price;
  await badRequest(`/dishes/${first.id}`, {
    method: "PUT", body: { ...valid, price: 0.001 }, authenticated: true
  }, "atualização com preço fracionário");
  assert.equal(first.price, previousPrice);
});

test("identificadores inválidos retornam 400 e cardápio de restaurante inexistente retorna 404", async () => {
  for (const id of ["0", "-1", "1.5", "true", "2147483648", "1e2", "0x1"]) {
    await badRequest(`/dishes/${id}`, { method: "GET" }, `identificador ${id}`);
    await badRequest(`/restaurants/${id}/dishes`, { method: "GET" }, `restaurante ${id}`);
  }
  const missing = await request("/restaurants/999/dishes", { method: "GET" });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "Restaurante não encontrado");
  const existing = await request("/restaurants/1/dishes", { method: "GET" });
  assert.equal(existing.status, 200);
  assert.ok(Array.isArray(existing.body));
});
