const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "activity-test-secret-that-is-long-enough";

const users = [
  { id: 1, name: "Proprietária", email: "dona@easyfood.test", password: "hash", imageUrl: null },
  { id: 2, name: "Outro usuário", email: "outro@easyfood.test", password: "hash", imageUrl: null }
];
const restaurants = [{ id: 1, name: "Restaurante da dona", ownerId: 1 }];
const dishes = [{ id: 1, name: "Prato inicial", category: "Almoço", description: "Descrição", price: "20.00", restaurantId: 1, imageUrl: null }];
const activities = [];

const prismaPath = require.resolve("../src/database/prisma");
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: {
    user: {
      async findUnique({ where }) {
        return users.find((user) => where.id ? user.id === where.id : user.email === where.email) || null;
      },
      async update({ where, data, select }) {
        const user = users.find((item) => item.id === where.id);
        Object.assign(user, data);
        return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
      }
    },
    restaurant: {
      async findUnique({ where }) { return restaurants.find((item) => item.id === where.id) || null; },
      async create({ data }) {
        const restaurant = { id: restaurants.length + 1, ...data };
        restaurants.push(restaurant);
        return restaurant;
      },
      async findMany() { return restaurants; }
    },
    dish: {
      async create({ data }) {
        const dish = { id: dishes.length + 1, imageUrl: null, ...data };
        dishes.push(dish);
        return dish;
      },
      async findMany({ where }) { return dishes.filter((dish) => dish.restaurantId === where.restaurantId); },
      async findUnique({ where }) { return dishes.find((dish) => dish.id === where.id) || null; },
      async update({ where, data }) {
        const dish = dishes.find((item) => item.id === where.id);
        Object.assign(dish, data);
        return dish;
      },
      async delete({ where }) {
        const index = dishes.findIndex((dish) => dish.id === where.id);
        return dishes.splice(index, 1)[0];
      }
    },
    activity: {
      async create({ data }) {
        const activity = { id: activities.length + 1, ...data };
        activities.push(activity);
        return activity;
      }
    }
  }
};

const emailServicePath = require.resolve("../src/modules/shared/email.service");
require.cache[emailServicePath] = {
  id: emailServicePath,
  filename: emailServicePath,
  loaded: true,
  exports: {
    async sendEmail() {},
    escapeHtml(value) { return String(value); }
  }
};

const imageServicePath = require.resolve("../src/modules/shared/image.service");
require.cache[imageServicePath] = {
  id: imageServicePath,
  filename: imageServicePath,
  loaded: true,
  exports: {
    async processAndStore(_buffer, folder) { return { path: `/uploads/${folder}/test.webp` }; },
    async removeStoredImage() {}
  }
};

const tokenFor = (id, email) => jwt.sign({ sub: id, email }, process.env.JWT_SECRET, { expiresIn: "1h" });
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

async function request(path, { method = "GET", body, token } = {}) {
  const headers = {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

function imageForm(type = "image/png") {
  const form = new FormData();
  form.append("image", new Blob(["test image data"], { type }), "test.png");
  return form;
}

test("pratos e imagens só podem ser alterados pelo proprietário do restaurante", async () => {
  const ownerToken = tokenFor(1, users[0].email);
  const otherToken = tokenFor(2, users[1].email);

  const ownedRestaurant = await request("/restaurants", {
    method: "POST", token: otherToken,
    body: { name: "Restaurante novo", category: "Brasileira", rating: 4.5 }
  });
  assert.equal(ownedRestaurant.status, 201);
  assert.equal(ownedRestaurant.body.ownerId, 2);

  const created = await request("/restaurants/1/dishes", {
    method: "POST", token: ownerToken,
    body: { name: "Novo prato", category: "Jantar", description: "Descrição", price: "35.50" }
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.restaurantId, 1);
  assert.equal((await request("/restaurants/1/dishes", {
    method: "POST", token: otherToken,
    body: { name: "Prato alheio", category: "Jantar", description: "Descrição", price: 15 }
  })).status, 403);
  assert.equal((await request("/dishes/1/image", { method: "POST", token: otherToken, body: imageForm() })).status, 403);
  assert.equal((await request("/dishes/1", { method: "PUT", token: otherToken, body: {
    name: "Alterado", category: "Jantar", description: "Descrição", price: 10
  } })).status, 403);
  assert.equal((await request("/dishes/1", { method: "DELETE", token: otherToken })).status, 403);
  assert.equal((await request("/dishes/999/image", { method: "POST", token: ownerToken, body: imageForm() })).status, 404);
  assert.equal((await request("/dishes/1/image", { method: "POST", body: imageForm() })).status, 401);

  const upload = await request("/dishes/1/image", { method: "POST", token: ownerToken, body: imageForm() });
  assert.equal(upload.status, 200);
  assert.equal(upload.body.imageUrl, "/uploads/dishes/test.webp");
  assert.equal((await request("/dishes/1", { method: "PUT", token: ownerToken, body: {
    name: "Prato atualizado", category: "Jantar", description: "Descrição", price: 25
  } })).status, 200);

  const profile = await request("/auth/me/image", { method: "POST", token: ownerToken, body: imageForm() });
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.id, 1);
  assert.equal(profile.body.user.imageUrl, "/uploads/profiles/test.webp");

  const invalidType = await request("/dishes/1/image", {
    method: "POST", token: ownerToken, body: imageForm("application/pdf")
  });
  assert.equal(invalidType.status, 400);
  assert.equal((await request("/dishes/1", { method: "DELETE", token: ownerToken })).status, 204);
  assert.ok(activities.length >= 2);
});
