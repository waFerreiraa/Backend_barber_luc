import { Router } from "express";
import { cadastrarUsuario, login, listarColaboradores } from "../controllers/authController.js"; // Importar listarColaboradores
import { autenticar, verificarAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/usuarios", autenticar, verificarAdmin, cadastrarUsuario);
router.post("/login", login);
router.get("/colaboradores", autenticar, listarColaboradores); // NOVO: Rota para listar colaboradores

export default router;