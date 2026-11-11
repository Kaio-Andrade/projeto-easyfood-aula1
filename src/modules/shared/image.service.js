const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const uploadRoot = path.resolve(process.cwd(), "uploads");
const allowedFormats = new Set(["jpeg", "png", "webp"]);

async function processAndStore(buffer, folder) {
  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    const error = new Error("O arquivo enviado não contém uma imagem válida");
    error.statusCode = 400;
    throw error;
  }

  if (!allowedFormats.has(metadata.format)) {
    const error = new Error("Formato inválido. Envie JPEG, PNG ou WebP");
    error.statusCode = 400;
    throw error;
  }

  const directory = path.join(uploadRoot, folder);
  await fs.mkdir(directory, { recursive: true });
  const filename = `${crypto.randomUUID()}.webp`;
  const destination = path.join(directory, filename);

  try {
    await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(destination);
  } catch {
    const error = new Error("Não foi possível processar a imagem");
    error.statusCode = 400;
    throw error;
  }

  return { path: `/uploads/${folder}/${filename}`, absolutePath: destination };
}

async function removeStoredImage(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith("/uploads/")) return;
  const absolutePath = path.resolve(uploadRoot, imageUrl.slice("/uploads/".length));
  if (!absolutePath.startsWith(`${uploadRoot}${path.sep}`)) return;
  await fs.rm(absolutePath, { force: true });
}

module.exports = { processAndStore, removeStoredImage };
