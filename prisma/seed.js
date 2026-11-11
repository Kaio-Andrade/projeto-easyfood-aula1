require("dotenv").config();

const bcrypt = require("bcryptjs");
const prisma = require("../src/database/prisma");

async function main() {
  const email = process.env.SEED_USER_EMAIL || "demo@easyfood.local";
  const password = process.env.SEED_USER_PASSWORD || "easyfood123";
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: "Usuário de demonstração", email, password: passwordHash }
  });

  const examples = [
    { name: "Pizzaria Napoli", category: "Pizza", rating: 4.5 },
    { name: "Burger House", category: "Burger", rating: 4.2 },
    { name: "Sushi Express", category: "Japonesa", rating: 4.8 }
  ];

  for (const data of examples) {
    const existing = await prisma.restaurant.findFirst({ where: { name: data.name, ownerId: user.id } });
    if (!existing) await prisma.restaurant.create({ data: { ...data, ownerId: user.id } });
  }

  console.log(`Dados de demonstração prontos para ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
