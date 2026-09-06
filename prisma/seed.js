const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // ... código anterior do seed.js
  await prisma.restaurant.createMany({
    data: [
      { name: "Pizzaria Napoli", category: "Pizza", rating: 4.5, description: "A melhor pizza da cidade" },
      { name: "Burger House", category: "Burger", rating: 4.2, description: "Hambúrgueres artesanais" },
      { name: "Sushi Express", category: "Japonesa", rating: 4.8, description: "Comida oriental rápida e fresca" }
    ]
  });
// ... resto do código
  console.log("Dados inseridos com sucesso!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());