const prisma = require("../../database/prisma");
const imageService = require("../shared/image.service");
const activityService = require("../shared/activity.service");

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw httpError("Identificador inválido", 400);
  return id;
}

function validateDish(data) {
  const fields = ["name", "category", "description"];
  if (!data || fields.some((field) => typeof data[field] !== "string" || !data[field].trim())) {
    throw httpError("Nome, categoria e descrição são obrigatórios", 400);
  }
  if (data.name.trim().length > 150 || data.category.trim().length > 100 || data.description.trim().length > 1000) {
    throw httpError("Os dados do prato excedem o tamanho permitido", 400);
  }
  const price = Number(data.price);
  if (data.price === "" || data.price === null || data.price === undefined || !Number.isFinite(price) || price <= 0) {
    throw httpError("O preço deve ser maior que zero", 400);
  }
  return {
    name: data.name.trim(),
    category: data.category.trim(),
    description: data.description.trim(),
    price: price.toFixed(2)
  };
}

function ensureOwnership(restaurant, userId) {
  if (restaurant.ownerId !== userId) {
    throw httpError("Você não tem permissão para gerenciar este restaurante", 403);
  }
}

async function findRestaurant(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: parseId(restaurantId) } });
  if (!restaurant) throw httpError("Restaurante não encontrado", 404);
  return restaurant;
}

async function getDish(dishId) {
  const dish = await prisma.dish.findUnique({ where: { id: parseId(dishId) } });
  if (!dish) throw httpError("Prato não encontrado", 404);
  return dish;
}

async function getOwnedDish(dishId, userId) {
  const dish = await getDish(dishId);
  const restaurant = await findRestaurant(dish.restaurantId);
  ensureOwnership(restaurant, userId);
  return dish;
}

async function record(action, dish, userId) {
  try {
    await activityService.log(action, `Prato ${dish.id} do restaurante ${dish.restaurantId}; usuário ${userId}`);
  } catch (error) {
    console.error("Erro ao registrar atividade:", error.message);
  }
}

async function createDish(restaurantId, data, userId) {
  const restaurant = await findRestaurant(restaurantId);
  ensureOwnership(restaurant, userId);
  const dish = await prisma.dish.create({
    data: { ...validateDish(data), restaurantId: restaurant.id }
  });
  await record("DISH_CREATED", dish, userId);
  return dish;
}

async function listDishes(restaurantId) {
  return prisma.dish.findMany({
    where: { restaurantId: parseId(restaurantId) },
    orderBy: { id: "asc" }
  });
}

async function updateDish(dishId, data, userId) {
  const dish = await getOwnedDish(dishId, userId);
  const updated = await prisma.dish.update({ where: { id: dish.id }, data: validateDish(data) });
  await record("DISH_UPDATED", updated, userId);
  return updated;
}

async function deleteDish(dishId, userId) {
  const dish = await getOwnedDish(dishId, userId);
  await prisma.dish.delete({ where: { id: dish.id } });
  await imageService.removeStoredImage(dish.imageUrl).catch(() => {});
  await record("DISH_DELETED", dish, userId);
}

async function uploadDishImage(dishId, buffer, userId) {
  const dish = await getOwnedDish(dishId, userId);
  const stored = await imageService.processAndStore(buffer, "dishes");
  try {
    const updated = await prisma.dish.update({ where: { id: dish.id }, data: { imageUrl: stored.path } });
    await imageService.removeStoredImage(dish.imageUrl).catch(() => {});
    await record("DISH_IMAGE_UPDATED", updated, userId);
    return updated;
  } catch (error) {
    await imageService.removeStoredImage(stored.path).catch(() => {});
    throw error;
  }
}

module.exports = { createDish, listDishes, getDish, updateDish, deleteDish, uploadDishImage, parseId };
