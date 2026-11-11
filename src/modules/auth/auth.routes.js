const express = require("express");
const controller = require("./auth.controller");
const authenticate = require("./auth.middleware");
const upload = require("../shared/upload.middleware");

const router = express.Router();

// Rotas públicas
router.post("/register", controller.register);
router.post("/login", controller.login);

// Rota protegida (exige o token JWT)
router.get("/me", authenticate, controller.me);
router.post("/me/image", authenticate, upload.single("image"), controller.uploadImage);

module.exports = router;
