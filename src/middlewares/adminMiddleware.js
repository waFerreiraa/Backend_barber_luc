export function ownerOnly(req, res, next) {
  if (req.usuario?.tipo_usuario !== 'dono') {
    return res.status(403).json({ error: "Acesso negado. Apenas o dono do sistema pode realizar esta ação." });
  }
  // Se for dono, continua para a próxima função (o controller)
  next();
}