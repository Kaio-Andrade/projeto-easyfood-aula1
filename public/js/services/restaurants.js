import { apiCall } from "./api.js";

export function listRestaurants() {
  return apiCall("/restaurants");
}

export function createRestaurant(restaurant) {
  return apiCall("/restaurants", { method: "POST", body: restaurant, authenticated: true });
}
