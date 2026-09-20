const express = require("express");
const controller = require("./auth.controller");
const authenticate = require("./auth.middleware");

const router = express.Router();

// Rotas públicas
router.post("/register", controller.register);
router.post("/login", controller.login);

// Rota protegida (exige o token JWT)
router.get("/me", authenticate, (req, res) => {
  // Como o middleware "authenticate" já validou o token e 
  // colocou os dados em req.user, basta retorná-los aqui
  res.json({ user: req.user });
});

module.exports = router;