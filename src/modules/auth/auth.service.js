const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../../database/prisma");
const imageService = require("../shared/image.service");
const activityService = require("../shared/activity.service");
const { JWT_SECRET } = require("./auth.config");
const { registrationData, loginData, parseId, httpError } = require("../shared/validation");

async function register(data) {
  const { name, email, password } = registrationData(data);
  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true }
  });
  if (existingUser) throw httpError("E-mail já cadastrado", 409);
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email, password: hash }
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

async function login(data) {
  const { email, password } = loginData(data);
  let user = await prisma.user.findUnique({
    where: { email }
  });

  // Older accounts may have been stored before email normalization existed.
  if (!user) {
    user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      orderBy: { id: "asc" }
    });
  }

  if (!user) {
    return null;
  }

  const senhaConfere = await bcrypt.compare(password, user.password);

  if (!senhaConfere) {
    return null;
  }

  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    JWT_SECRET,
    {
      expiresIn: "1d"
    }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl
    }
  };
}

async function getById(id) {
  return prisma.user.findUnique({
    where: { id: parseId(id) },
    select: { id: true, name: true, email: true, imageUrl: true }
  });
}

async function uploadProfileImage(userId, buffer) {
  const id = parseId(userId);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    const error = new Error("Usuário não encontrado");
    error.statusCode = 404;
    throw error;
  }

  const stored = await imageService.processAndStore(buffer, "profiles");
  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { imageUrl: stored.path },
      select: { id: true, name: true, email: true, imageUrl: true }
    });
    await imageService.removeStoredImage(user.imageUrl).catch(() => {});
    await activityService.log("PROFILE_IMAGE_UPDATED", `Imagem atualizada para usuário ${id}`).catch((error) => {
      console.error("Erro ao registrar atividade:", error.message);
    });
    return updatedUser;
  } catch (error) {
    await imageService.removeStoredImage(stored.path).catch(() => {});
    throw error;
  }
}

module.exports = {
  register,
  login,
  getById,
  uploadProfileImage
};
