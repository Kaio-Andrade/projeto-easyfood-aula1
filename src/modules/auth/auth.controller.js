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
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Nome, e-mail e senha são obrigatórios"
    });
  }

  try {
    const user = await authService.register({
      name,
      email,
      password
    });

    res.status(201).json(user);
  } catch (error) {
    console.error("Erro real do Prisma:", error);
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "E-mail já cadastrado"
      });
    }

    res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "E-mail e senha são obrigatórios"
    });
  }

  try {
    const result = await authService.login({
      email,
      password
    });

    if (!result) {
      return res.status(401).json({
        error: "Credenciais inválidas"
      });
    }

    res.json(result);
  } catch (error) {
     console.error("Erro real do Prisma:", error);
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
