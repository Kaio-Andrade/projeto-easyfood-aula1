const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || !JWT_SECRET.trim()) {
  throw new Error("Configure JWT_SECRET antes de iniciar a aplicação");
}

module.exports = { JWT_SECRET };
