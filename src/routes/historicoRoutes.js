import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import { buscarHistorico } from "../controllers/historicoController.js";

const router = Router();

router.get("/historico", autenticar, buscarHistorico);

export default router;