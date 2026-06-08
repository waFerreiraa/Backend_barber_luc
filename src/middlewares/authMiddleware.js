import jwt from "jsonwebtoken";

/**
 * Middleware de autenticação (JWT próprio)
 * - Exige: Authorization: Bearer <token>
 * - Valida assinatura e expiração
 * - Exige claims mínimas: id e empresa_id (multi-empresa)
 * - Injeta req.usuario = { id, empresa_id, tipo_usuario }
 */
export function autenticar(req, res, next) {
  const authHeader = req.headers.authorization || "";

  // ✅ valida formato Bearer
  if (!authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Formato inválido. Use: Authorization: Bearer <token>" });
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // 🔐 validação extra para multi-empresa
    if (!payload?.id || !payload?.empresa_id) {
      return res.status(401).json({ error: "Token inválido ou incompleto" });
    }

    req.usuario = {
      id: payload.id,
      empresa_id: payload.empresa_id,
      tipo_usuario: payload.tipo_usuario || "colaborador",
    };

    return next();
  } catch (error) {
    // token expirado, assinatura inválida, etc.
    return res.status(401).json({ error: "Token expirado ou inválido" });
  }
}

/**
 * Middleware de autorização: apenas admin
 */
export function verificarAdmin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ error: "Usuário não autenticado" });
  }

  // ✅ Permite que 'dono' e 'admin' realizem ações administrativas
  if (req.usuario.tipo_usuario !== "admin" && req.usuario.tipo_usuario !== "dono") {
    return res.status(403).json({ error: "Acesso negado. Permissão de administrador necessária." });
  }

  return next();
}
