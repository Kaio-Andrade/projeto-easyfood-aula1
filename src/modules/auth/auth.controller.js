const authService = require("./auth.service");

async function me(req, res) {
  try {
    const user = await authService.getById(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    return res.json({ user });
  } catch (error) {
    console.error("Erro ao consultar usuário autenticado:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

async function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: "Nenhuma imagem enviada" });
  try {
    const user = await authService.uploadProfileImage(req.user.id, req.file.buffer);
    return res.json({ user });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) console.error("Erro ao atualizar imagem de perfil:", error);
    return res.status(status).json({ error: status === 500 ? "Erro ao processar imagem" : error.message });
  }
}

async function register(req, res) {
  try {
    const user = await authService.register(req.body);

    res.status(201).json(user);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "E-mail já cadastrado"
      });
    }

    console.error("Erro ao cadastrar usuário:", error);
    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);

    if (!result) {
      return res.status(401).json({
        error: "Credenciais inválidas"
      });
    }

    res.json(result);
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    console.error("Erro ao autenticar usuário:", error);
    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
}

module.exports = {
  register,
  login,
  me,
  uploadImage
};
