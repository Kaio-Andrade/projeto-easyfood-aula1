import { apiCall, uploadImage } from "./api.js";

export function listDishes(restaurantId) {
  return apiCall(`/restaurants/${restaurantId}/dishes`);
}

export function createDish(restaurantId, dish) {
  return apiCall(`/restaurants/${restaurantId}/dishes`, { method: "POST", body: dish, authenticated: true });
}

export function updateDish(dishId, dish) {
  return apiCall(`/dishes/${dishId}`, { method: "PUT", body: dish, authenticated: true });
}

export function deleteDish(dishId) {
  return apiCall(`/dishes/${dishId}`, { method: "DELETE", authenticated: true });
}

export function uploadDishImage(dishId, file) {
  return uploadImage(`/dishes/${dishId}/image`, file);
}
