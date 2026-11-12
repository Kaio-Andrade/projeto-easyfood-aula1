import { getToken } from "../services/api.js";
import { getCurrentUser, loginUser, logout, registerUser, uploadProfileImage } from "../services/auth.js";
import { createRestaurant, listRestaurants } from "../services/restaurants.js";
import { createDish, deleteDish, listDishes, updateDish, uploadDishImage } from "../services/dishes.js";

const $ = (selector) => document.querySelector(selector);
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let user = null;
let restaurants = [];
let selectedRestaurant = null;
let dishes = [];
let selectionVersion = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function notify(message, error = false) {
  const notice = $("#notice");
  notice.textContent = message;
  notice.classList.toggle("error", error);
  notice.hidden = false;
}

function showResult(result) {
  $("#apiOutput").textContent = JSON.stringify(result, (key, value) => key === "token" ? "[token armazenado nesta aba]" : value, 2);
}

async function request(action) {
  let result;
  try { result = await action(); }
  catch { throw new Error("Não foi possível conectar ao servidor. Confira sua conexão e tente novamente."); }
  showResult(result);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(result.sessionExpired ? "Sua sessão não está ativa. Entre novamente para continuar." : result.data?.error || "Não foi possível concluir a operação.");
  }
  return result.data;
}

async function run(action, container) {
  const controls = container ? [...container.querySelectorAll("button, input, textarea")] : [];
  const active = controls.filter((control) => !control.disabled);
  active.forEach((control) => { control.disabled = true; });
  try { await action(); }
  catch (error) { notify(error.message, true); }
  finally { active.forEach((control) => { control.disabled = false; }); }
}

function safeImagePath(value) {
  if (typeof value !== "string" || !value.startsWith("/uploads/")) return null;
  const url = new URL(value, window.location.origin);
  return url.origin === window.location.origin ? url.href : null;
}

function ownsSelectedRestaurant() {
  return Boolean(user && selectedRestaurant && user.id === selectedRestaurant.ownerId);
}

function closeDishForm() {
  $("#dishForm").hidden = true;
  $("#dishForm").reset();
  $("#dishId").value = "";
}

function renderSession() {
  $("#authForms").hidden = Boolean(user);
  $("#profilePanel").hidden = !user;
  $("#restaurantCreatePanel").hidden = !user;
  $("#restaurantLoginHint").hidden = Boolean(user);
  $("#tokenDisplay").textContent = user ? `Conectado como ${user.name}` : "Não autenticado";
  $("#profileName").textContent = user?.name || "";
  $("#profileEmail").textContent = user?.email || "";
  const image = safeImagePath(user?.imageUrl);
  $("#profileImage").hidden = !image;
  if (image) $("#profileImage").src = image;
  else $("#profileImage").removeAttribute("src");
  $("#newDishButton").hidden = !ownsSelectedRestaurant();
  if (!ownsSelectedRestaurant()) closeDishForm();
  if (selectedRestaurant) $("#menuDescription").textContent = ownsSelectedRestaurant() ? "Seu restaurante. Adicione pratos e deixe o cardápio com a sua cara." : "Conheça os pratos preparados por este restaurante.";
  renderRestaurants();
  renderDishes();
}

function renderRestaurants() {
  const list = $("#restaurantList");
  const focusedRestaurantId = document.activeElement?.dataset?.restaurantId;
  list.replaceChildren();
  $("#restaurantsStatus").textContent = restaurants.length ? `${restaurants.length} restaurante${restaurants.length === 1 ? "" : "s"} para conhecer` : "Ainda não há restaurantes cadastrados.";
  for (const restaurant of restaurants) {
    const item = element("li");
    const button = element("button", "restaurant-button");
    button.type = "button";
    button.dataset.restaurantId = restaurant.id;
    button.setAttribute("aria-pressed", String(selectedRestaurant?.id === restaurant.id));
    button.setAttribute("aria-label", `Ver cardápio de ${restaurant.name}`);
    const symbol = element("span", "restaurant-symbol", String(restaurant.name).trim().charAt(0).toUpperCase());
    symbol.setAttribute("aria-hidden", "true");
    const text = element("span", "restaurant-text");
    text.append(element("span", "restaurant-name", restaurant.name), element("span", "restaurant-meta", restaurant.category || "Sabores variados"));
    if (user?.id === restaurant.ownerId) text.append(element("span", "owner-badge", "Seu restaurante"));
    const rating = Number(restaurant.rating);
    button.append(symbol, text, element("span", "restaurant-rating", Number.isFinite(rating) ? `★ ${rating.toFixed(1)}` : ""));
    button.addEventListener("click", () => run(() => selectRestaurant(restaurant)));
    item.append(button);
    list.append(item);
  }
  if (focusedRestaurantId) list.querySelector(`[data-restaurant-id="${Number(focusedRestaurantId)}"]`)?.focus();
}

async function loadRestaurants() {
  restaurants = await request(listRestaurants);
  if (selectedRestaurant) selectedRestaurant = restaurants.find((item) => item.id === selectedRestaurant.id) || null;
  renderRestaurants();
  $("#newDishButton").hidden = !ownsSelectedRestaurant();
  renderDishes();
}

async function selectRestaurant(restaurant) {
  const version = ++selectionVersion;
  selectedRestaurant = restaurant;
  dishes = [];
  closeDishForm();
  renderRestaurants();
  $("#menuTitle").textContent = restaurant.name;
  $("#menuCategory").textContent = restaurant.category || "EXPLORE O CARDÁPIO";
  $("#menuDescription").textContent = ownsSelectedRestaurant() ? "Seu restaurante. Adicione pratos e deixe o cardápio com a sua cara." : "Conheça os pratos preparados por este restaurante.";
  $("#newDishButton").hidden = !ownsSelectedRestaurant();
  $("#dishList").replaceChildren();
  $("#dishesStatus").hidden = false;
  $("#dishesStatus").textContent = "Carregando cardápio…";
  try {
    const items = await request(() => listDishes(restaurant.id));
    if (version !== selectionVersion) return;
    dishes = items;
    renderDishes();
  } catch (error) {
    if (version === selectionVersion) $("#dishesStatus").textContent = "Não foi possível carregar o cardápio. Selecione o restaurante para tentar novamente.";
    throw error;
  }
}

function openDishForm(dish) {
  if (!ownsSelectedRestaurant()) return;
  $("#dishForm").reset();
  $("#dishFormTitle").textContent = dish ? "Editar prato" : "Novo prato";
  $("#dishId").value = dish?.id || "";
  $("#dishName").value = dish?.name || "";
  $("#dishCategory").value = dish?.category || "";
  $("#dishDescription").value = dish?.description || "";
  $("#dishPrice").value = dish ? Number(dish.price).toFixed(2) : "";
  $("#dishForm").hidden = false;
  $("#dishName").focus();
}

function validatedImage(input) {
  const file = input.files?.[0];
  if (!file) throw new Error("Selecione uma imagem para enviar.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Selecione uma imagem JPEG, PNG ou WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
  return file;
}

function renderDishes() {
  const list = $("#dishList");
  list.replaceChildren();
  $("#dishesStatus").hidden = Boolean(selectedRestaurant && dishes.length);
  $("#dishesStatus").textContent = selectedRestaurant ? "Este cardápio ainda não tem pratos. Novos sabores chegam em breve." : "Cada restaurante tem uma história. Comece escolhendo um.";
  for (const dish of dishes) {
    const card = element("article", "dish-card");
    card.dataset.dishId = dish.id;
    const imageWrap = element("div", "dish-image-wrap");
    const path = safeImagePath(dish.imageUrl);
    if (path) {
      const image = element("img");
      image.src = path;
      image.alt = dish.name;
      image.loading = "lazy";
      imageWrap.append(image);
    } else {
      const placeholder = element("span", "dish-placeholder", "ef.");
      placeholder.setAttribute("aria-hidden", "true");
      imageWrap.append(placeholder);
    }
    const body = element("div", "dish-body");
    body.append(element("p", "dish-category", dish.category), element("h3", "", dish.name), element("p", "dish-description", dish.description), element("strong", "dish-price", money.format(Number(dish.price))));
    if (ownsSelectedRestaurant()) {
      const actions = element("div", "dish-actions");
      const edit = element("button", "text-button", "Editar");
      edit.type = "button";
      edit.dataset.action = "edit-dish";
      edit.setAttribute("aria-label", `Editar ${dish.name}`);
      edit.addEventListener("click", () => openDishForm(dish));
      const remove = element("button", "text-button danger", "Excluir");
      remove.type = "button";
      remove.dataset.action = "delete-dish";
      remove.setAttribute("aria-label", `Excluir ${dish.name}`);
      remove.addEventListener("click", () => {
        if (!window.confirm(`Excluir o prato “${dish.name}”? Essa ação remove também a foto do prato.`)) return;
        const restaurant = selectedRestaurant;
        run(async () => {
          await request(() => deleteDish(dish.id));
          if (selectedRestaurant?.id === restaurant.id) await selectRestaurant(restaurant);
          notify("Prato excluído.");
        }, card);
      });
      actions.append(edit, remove);
      const uploadDetails = element("details", "dish-upload");
      uploadDetails.append(element("summary", "", dish.imageUrl ? "Trocar foto do prato" : "Adicionar foto do prato"));
      const form = element("form");
      const label = element("label", "", "Imagem do prato");
      label.htmlFor = `dishImage-${dish.id}`;
      const input = element("input");
      input.id = label.htmlFor;
      input.name = "image";
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/webp";
      input.required = true;
      const hint = element("p", "muted", "JPEG, PNG ou WebP, até 5 MB.");
      hint.id = `dishImageHelp-${dish.id}`;
      input.setAttribute("aria-describedby", hint.id);
      const submit = element("button", "secondary", "Enviar foto");
      submit.type = "submit";
      form.append(label, input, hint, submit);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const restaurant = selectedRestaurant;
        run(async () => {
          const file = validatedImage(input);
          await request(() => uploadDishImage(dish.id, file));
          if (selectedRestaurant?.id === restaurant.id) await selectRestaurant(restaurant);
          notify("Foto do prato atualizada.");
        }, form);
      });
      uploadDetails.append(form);
      body.append(actions, uploadDetails);
    }
    card.append(imageWrap, body);
    list.append(card);
  }
}

$("#accountButton").addEventListener("click", () => {
  $("#accountPanel").open = true;
  $("#accountPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  (user ? $("#profileImageInput") : $("#loginEmail")).focus();
});

$("#registerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  run(async () => {
    await request(() => registerUser(values));
    $("#loginEmail").value = values.email;
    form.reset();
    $("#loginPassword").focus();
    notify("Conta criada! Entre com seu e-mail e senha para continuar.");
  }, form);
});

$("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  run(async () => {
    const result = await request(() => loginUser(values));
    user = result.user;
    form.reset();
    renderSession();
    if (selectedRestaurant) await selectRestaurant(selectedRestaurant);
    notify(`Bem-vindo, ${user.name}!`);
  }, form);
});

$("#meButton").addEventListener("click", () => run(async () => {
  const data = await request(getCurrentUser);
  user = data.user;
  renderSession();
  notify("Perfil atualizado.");
}));

$("#logoutButton").addEventListener("click", () => {
  logout();
  user = null;
  $("#profileImageForm").reset();
  $("#restaurantForm").reset();
  renderSession();
  notify("Você saiu da sua conta.");
});

window.addEventListener("easyfood:session-expired", () => {
  user = null;
  renderSession();
  $("#accountPanel").open = true;
  notify("Sua sessão expirou. Entre novamente para continuar.", true);
});

$("#profileImageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  run(async () => {
    const file = validatedImage($("#profileImageInput"));
    const data = await request(() => uploadProfileImage(file));
    user = data.user;
    form.reset();
    renderSession();
    notify("Sua foto de perfil foi atualizada.");
  }, form);
});

$("#listRestaurantsButton").addEventListener("click", () => run(loadRestaurants));

$("#restaurantForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  values.rating = values.rating === "" ? 0 : Number(values.rating);
  run(async () => {
    const restaurant = await request(() => createRestaurant(values));
    await loadRestaurants();
    await selectRestaurant(restaurant);
    form.reset();
    $("#restaurantCreatePanel").open = false;
    notify("Restaurante cadastrado! Agora você pode adicionar os pratos.");
  }, form);
});

$("#newDishButton").addEventListener("click", () => openDishForm());
$("#cancelDishButton").addEventListener("click", closeDishForm);
$("#dishForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form));
  const id = values.dishId;
  delete values.dishId;
  const restaurant = selectedRestaurant;
  if (!restaurant || !ownsSelectedRestaurant()) return notify("Selecione um restaurante seu para gerenciar os pratos.", true);
  run(async () => {
    await request(() => id ? updateDish(id, values) : createDish(restaurant.id, values));
    if (selectedRestaurant?.id === restaurant.id) await selectRestaurant(restaurant);
    notify(id ? "Prato atualizado." : "Prato cadastrado! Você já pode adicionar uma foto.");
  }, form);
});

async function initialize() {
  renderSession();
  if (getToken()) {
    await run(async () => {
      const data = await request(getCurrentUser);
      user = data.user;
      renderSession();
    });
  }
  await run(loadRestaurants);
}

initialize();
