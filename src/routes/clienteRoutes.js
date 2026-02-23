import { Router } from "express";
import { autenticar } from "../middlewares/authMiddleware.js";
import {
  listarClientes,
  criarCliente,
} from "../controllers/clienteController.js";

const router = Router();

router.get("/clientes", autenticar, listarClientes);
router.post("/clientes", autenticar, criarCliente);

export default router;
