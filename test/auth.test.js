const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const bcrypt = require("bcryptjs");

process.env.JWT_SECRET = "auth-test-secret-that-is-long-enough";

const users = [];
const restaurants = [];
const activities = [];
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
      },
      async update({ where, data, select }) {
        const user = users.find((item) => item.id === where.id);
        if (!user) throw new Error("User not found");
        Object.assign(user, data);
        return select ? Object.fromEntries(Object.keys(select).map((key) => [key, user[key]])) : user;
      }
    },
    restaurant: {
      async findMany() { return restaurants; },
      async create({ data }) {
        const restaurant = { id: restaurants.length + 1, ...data };
        restaurants.push(restaurant);
        return restaurant;
      }
    },
    activity: {
      async create({ data }) {
        const entry = { id: activities.length + 1, ...data };
        activities.push(entry);
        return entry;
      }
    }
  }
};

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

async function request(path, { method = "GET", body, authorization } = {}) {
  const headers = {};
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body)
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

test("cadastro, hash, login e acesso protegido retornam a identidade autenticada", async () => {
  const credentials = { name: "Pessoa Teste", email: "pessoa@easyfood.test", password: "senha-forte" };
  const registered = await request("/auth/register", { method: "POST", body: credentials });
  assert.equal(registered.status, 201);
  assert.notEqual(users[0].password, credentials.password);
  assert.equal(await bcrypt.compare(credentials.password, users[0].password), true);

  const login = await request("/auth/login", {
    method: "POST",
    body: { email: credentials.email, password: credentials.password }
  });
  assert.equal(login.status, 200);
  const me = await request("/auth/me", { authorization: `Bearer ${login.body.token}` });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.id, registered.body.id);
  assert.equal((await request("/auth/me")).status, 401);
});
