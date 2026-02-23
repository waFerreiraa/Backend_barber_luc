import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import { relatorioGanhos } from "../controllers/relatorioController.js";

const router = Router();

/**
 * GET /api/relatorio/ganhos?mes=1&ano=2026
 * Retorna PDF (admin: empresa toda | colaborador: só suas vendas, se seu controller faz isso)
 */
router.get("/relatorio/ganhos", autenticar, relatorioGanhos);

export default router;