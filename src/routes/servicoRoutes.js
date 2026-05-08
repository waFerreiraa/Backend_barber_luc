import { Router } from "express";
import { autenticar, verificarAdmin } from "../middlewares/authMiddleware.js"; // Importar verificarAdmin
import {
  listarServicos,
  criarServico,
  atualizarServico, // Importar nova função
  excluirServico,   // Importar nova função
} from "../controllers/servicoController.js";

const router = Router();

router.get("/tipos_servicos", autenticar, listarServicos);
router.post("/tipos_servicos", autenticar, verificarAdmin, criarServico); // Apenas admin pode criar
router.put("/tipos_servicos/:id", autenticar, verificarAdmin, atualizarServico); // Apenas admin pode atualizar
router.delete("/tipos_servicos/:id", autenticar, verificarAdmin, excluirServico); // Apenas admin pode excluir

export default router;
