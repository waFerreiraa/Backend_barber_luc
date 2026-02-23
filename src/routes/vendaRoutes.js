// vendaRoutes.js
import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import {
  registrarVenda,
  excluirVenda, // <<-- importamos a nova função
} from "../controllers/vendaController.js";

const router = Router();

router.post("/vendas", autenticar, registrarVenda);

// rota DELETE para excluir uma venda (bate com a URL que seu frontend chamou)
router.delete("/vendas/:id", autenticar, excluirVenda);

// opcional: rota compatível com legacy se quiser manter /excluir-cliente
router.delete("/vendas/:id/excluir-cliente", autenticar, excluirVenda);

export default router;