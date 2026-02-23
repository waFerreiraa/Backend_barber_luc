import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import {
  listarServicos,
  criarServico,
} from "../controllers/servicoController.js";

const router = Router();

router.get("/tipos_servicos", autenticar, listarServicos);
router.post("/tipos_servicos", autenticar, criarServico);

export default router;
