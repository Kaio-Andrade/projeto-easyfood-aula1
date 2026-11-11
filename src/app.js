const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const restaurantRoutes = require("./modules/restaurants/restaurant.routes");
const authRoutes = require("./modules/auth/auth.routes");
const dishRoutes = require("./modules/dishes/dish.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.use("/auth", authRoutes);
app.use("/restaurants", restaurantRoutes);
app.use(dishRoutes);

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "A imagem deve ter no máximo 5 MB" : "Upload inválido"
    });
  }
  if (error.statusCode) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  console.error("Erro não tratado:", error);
  return res.status(500).json({ error: "Erro interno do servidor" });
});

module.exports = app;
