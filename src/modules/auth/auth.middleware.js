const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./auth.config");

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === "string" && /^Bearer ([^\s]+)$/i.exec(authHeader);
  if (!match) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    if (
      !Number.isSafeInteger(payload.sub) || payload.sub <= 0 ||
      typeof payload.email !== "string" || !payload.email ||
      !Number.isInteger(payload.exp)
    ) {
      return res.status(401).json({ error: "Token inválido" });
    }
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = authenticate;
