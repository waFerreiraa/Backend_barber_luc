import { Router } from "express";
import { autenticar, verificarAdmin } from "../middlewares/authMiddleware.js";
import {
  listarAgendamentos,
  criarAgendamento,
  atualizarAgendamento,
  excluirAgendamento,
} from "../controllers/agendamentoController.js";

const router = Router();

router.get("/agendamentos", autenticar, listarAgendamentos);
router.post("/agendamentos", autenticar, criarAgendamento);
router.put("/agendamentos/:id", autenticar, atualizarAgendamento);
router.delete("/agendamentos/:id", autenticar, excluirAgendamento);

// Rotas que podem exigir admin para certas operações (ex: excluir agendamento de outro barbeiro)

export default router;