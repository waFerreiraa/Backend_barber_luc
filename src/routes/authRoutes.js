import { Router } from "express";
import { cadastrarUsuario, login } from "../controllers/authController.js";
import { autenticar, verificarAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/usuarios", autenticar, verificarAdmin, cadastrarUsuario);
router.post("/login", login);

export default router;