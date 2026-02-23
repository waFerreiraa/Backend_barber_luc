import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import { buscarSumario } from "../controllers/sumarioController.js";

const router = Router();

/**
 * GET /sumario
 * (Se no seu index você já faz router.use("/api", sumarioRoutes),
 * então a URL final fica /api/sumario)
 */
router.get("/sumario", autenticar, buscarSumario);

export default router;