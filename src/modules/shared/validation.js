function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function objectBody(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw httpError("Envie um objeto JSON com os dados obrigatórios");
  }
  return value;
}

function requiredText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(`${label} é obrigatório e deve ser um texto`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw httpError(`${label} deve ter no máximo ${maxLength} caracteres`);
  }
  return text;
}

function emailAddress(value) {
  const email = requiredText(value, "E-mail", 150).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError("Informe um e-mail válido");
  }
  return email;
}

function passwordValue(value, minimumLength = 8) {
  // bcrypt only considers the first 72 bytes, including multibyte characters.
  if (typeof value !== "string" || value.trim().length < minimumLength || Buffer.byteLength(value, "utf8") > 72) {
    throw httpError(minimumLength === 8
      ? "A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes"
      : "A senha é obrigatória e deve ter no máximo 72 bytes");
  }
  return value;
}

function parseId(value) {
  if (
    !(typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) ||
    !Number.isInteger(Number(value)) || Number(value) <= 0 || Number(value) > 2_147_483_647
  ) {
    throw httpError("Identificador inválido");
  }
  return Number(value);
}

function ratingValue(value) {
  if (value === undefined) return 0;
  if (typeof value !== "number" && typeof value !== "string") {
    throw httpError("A avaliação deve ser de 0 a 5, com no máximo uma casa decimal");
  }
  const text = String(value).trim();
  const rating = Number(text);
  if (!/^\d+(?:\.\d)?$/.test(text) || !Number.isFinite(rating) || rating < 0 || rating > 5) {
    throw httpError("A avaliação deve ser de 0 a 5, com no máximo uma casa decimal");
  }
  return rating;
}

function priceValue(value) {
  const message = "O preço deve ser de 0.01 a 99999999.99, com até duas casas decimais";
  if (typeof value !== "number" && typeof value !== "string") throw httpError(message);
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw httpError(message);
  const [rawInteger, fraction = ""] = text.split(".");
  const integer = rawInteger.replace(/^0+(?=\d)/, "");
  const cents = fraction.padEnd(2, "0");
  // Validate the decimal representation before persistence: no rounding or
  // floating-point conversion may turn a positive input into a free dish.
  if (integer.length > 8 || (integer === "0" && cents === "00")) throw httpError(message);
  return `${integer}.${cents}`;
}

function registrationData(value) {
  const data = objectBody(value);
  return {
    name: requiredText(data.name, "Nome", 150),
    email: emailAddress(data.email),
    password: passwordValue(data.password)
  };
}

function loginData(value) {
  const data = objectBody(value);
  // Existing accounts may have been registered before the minimum length rule.
  return { email: emailAddress(data.email), password: passwordValue(data.password, 1) };
}

function restaurantData(value) {
  const data = objectBody(value);
  return {
    name: requiredText(data.name, "Nome", 150),
    category: requiredText(data.category, "Categoria", 100),
    rating: ratingValue(data.rating)
  };
}

function dishData(value) {
  const data = objectBody(value);
  return {
    name: requiredText(data.name, "Nome", 150),
    category: requiredText(data.category, "Categoria", 100),
    description: requiredText(data.description, "Descrição", 1000),
    price: priceValue(data.price)
  };
}

module.exports = { httpError, parseId, registrationData, loginData, restaurantData, dishData };
