const prisma = require("../../database/prisma");
const emailService = require("../shared/email.service");
const activityService = require("../shared/activity.service");
const { escapeHtml } = emailService;
const { restaurantData } = require("../shared/validation");

async function runSecondaryAction(label, action) {
  try {
    await action();
  } catch (error) {
    console.error(`${label}:`, error.message);
  }
}

async function listRestaurants() {
  return prisma.restaurant.findMany();
}

async function createRestaurant(data, user) {
  const validated = restaurantData(data);
  const restaurant = await prisma.restaurant.create({
    data: {
      ...validated,
      ownerId: user.id
    }
  });

  await runSecondaryAction("Erro ao enviar e-mail de boas-vindas", () => emailService.sendEmail({
    to: user.email,
    toName: restaurant.name,
    subject: `Bem-vindo à EasyFood, ${restaurant.name}!`,
    header: `Olá, ${restaurant.name}!`,
    body: `Seu restaurante <strong>${escapeHtml(restaurant.name)}</strong> foi cadastrado com sucesso na EasyFood.`,
    footer: "Equipe EasyFood"
  }));

  await runSecondaryAction("Erro ao registrar atividade", () => activityService.log(
    "RESTAURANT_CREATED",
    `Restaurante ${restaurant.id} criado pelo usuário ${user.id}`
  ));

  if (process.env.EMAIL_TO) {
    await runSecondaryAction("Erro ao notificar o comercial", () => emailService.sendEmail({
      to: process.env.EMAIL_TO,
      toName: "Comercial EasyFood",
      subject: `Novo restaurante cadastrado: ${restaurant.name}`,
      header: "Novo restaurante na plataforma",
      body: `Nome: ${escapeHtml(restaurant.name)}<br/>Categoria: ${escapeHtml(restaurant.category || "Não informada")}<br/>Avaliação: ${restaurant.rating}`,
      footer: "Notificação automática — EasyFood"
    }));
  }

  return restaurant;
}

module.exports = {
  listRestaurants,
  createRestaurant
};
