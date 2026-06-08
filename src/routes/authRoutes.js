import { Router } from "express";
import {
  cadastrarUsuario,
  login,
  listarColaboradores,
  alterarSenha,
  alterarEmail,
  solicitarResetSenha,
  resetarSenha,
} from "../controllers/authController.js";
import { autenticar, verificarAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/usuarios", autenticar, verificarAdmin, cadastrarUsuario);
router.post("/login", login);
router.get("/colaboradores", autenticar, listarColaboradores);

// Rotas de alteração de dados do usuário logado
router.put("/alterar-senha", autenticar, alterarSenha);
router.put("/alterar-email", autenticar, alterarEmail);

// Rotas de recuperação de senha (públicas)
router.post("/esqueci-senha", solicitarResetSenha);
router.post("/resetar-senha", resetarSenha);

export default router;