import { getToken } from "../services/api.js";
import { getCurrentUser, loginUser, logout, registerUser } from "../services/auth.js";
import { createRestaurant, listRestaurants } from "../services/restaurants.js";

const output = document.querySelector("#apiOutput");
const tokenDisplay = document.querySelector("#tokenDisplay");

function showResult(result) {
  output.textContent = JSON.stringify(result, null, 2);
}

function updateTokenStatus() {
  tokenDisplay.textContent = getToken() ? "Token armazenado nesta aba" : "Não autenticado";
}

async function showRequest(request) {
  try {
    showResult(await request());
  } catch (error) {
    showResult({ error: error.message });
  }
}

document.querySelector("#registerForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await showRequest(() => registerUser(Object.fromEntries(form)));
});

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await showRequest(async () => {
    const result = await loginUser(Object.fromEntries(form));
    updateTokenStatus();
    return result;
  });
});

document.querySelector("#meButton").addEventListener("click", () => showRequest(getCurrentUser));
document.querySelector("#logoutButton").addEventListener("click", () => {
  logout();
  updateTokenStatus();
  showResult({ message: "Sessão removida desta aba" });
});
document.querySelector("#listRestaurantsButton").addEventListener("click", () => showRequest(listRestaurants));

document.querySelector("#restaurantForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const restaurant = Object.fromEntries(form);
  restaurant.rating = restaurant.rating ? Number(restaurant.rating) : undefined;
  await showRequest(() => createRestaurant(restaurant));
});

updateTokenStatus();
