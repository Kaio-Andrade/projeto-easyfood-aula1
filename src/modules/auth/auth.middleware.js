const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

function authenticate(req, res, next) {
  // Busca o token no cabeçalho da requisição
  const authHeader = req.headers.authorization;

  // Se não houver token, bloqueia com erro 401 Unauthorized
  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  // O formato esperado é "Bearer <token>", então separamos pelo espaço
  const [, token] = authHeader.split(" ");

  try {
    // Verifica se o token é válido usando a chave secreta
    const payload = jwt.verify(token, JWT_SECRET);
    
    // Repassa os dados do usuário logado para a requisição
    req.user = payload;
    
    // Libera a requisição para prosseguir (ex: ir para o controller.create)
    next();
  } catch (error) {
    // Se o token for inválido ou expirado, bloqueia com erro 401
    return res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = authenticate;