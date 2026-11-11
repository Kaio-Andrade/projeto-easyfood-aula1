const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const prisma = require("../../database/prisma");
const imageService = require("../shared/image.service");
const activityService = require("../shared/activity.service");
const { JWT_SECRET } = require("./auth.config");

async function register({ name, email, password }) {
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

async function login({ email, password }) {
  const user = await prisma.user.findUnique({
    where: { email }
  });

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
    where: { id: Number(id) },
    select: { id: true, name: true, email: true, imageUrl: true }
  });
}

async function uploadProfileImage(userId, buffer) {
  const id = Number(userId);
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
