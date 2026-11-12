const prisma = require("../../database/prisma");
const imageService = require("../shared/image.service");
const activityService = require("../shared/activity.service");
const { httpError, parseId, dishData } = require("../shared/validation");

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
    data: { ...dishData(data), restaurantId: restaurant.id }
  });
  await record("DISH_CREATED", dish, userId);
  return dish;
}

async function listDishes(restaurantId) {
  const restaurant = await findRestaurant(restaurantId);
  return prisma.dish.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { id: "asc" }
  });
}

async function updateDish(dishId, data, userId) {
  const dish = await getOwnedDish(dishId, userId);
  const updated = await prisma.dish.update({ where: { id: dish.id }, data: dishData(data) });
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
