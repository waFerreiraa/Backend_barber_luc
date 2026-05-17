import { Router } from "express";

import authRoutes from "./authRoutes.js";
import clienteRoutes from "./clienteRoutes.js";
import servicoRoutes from "./servicoRoutes.js";
import vendaRoutes from "./vendaRoutes.js";
import agendamentoRoutes from "./agendamentoRoutes.js"; // NOVO
import sumarioRoutes from "./sumarioRoutes.js";
import relatorioRoutes from "./relatorioRoutes.js";
import historicoRoutes from "./historicoRoutes.js";
import registroRoutes from "./registrosRoutes.js";

const router = Router();

router.use(authRoutes);
router.use(clienteRoutes);
router.use(servicoRoutes);
router.use(vendaRoutes);
router.use(agendamentoRoutes); // NOVO
router.use(sumarioRoutes);
router.use(relatorioRoutes);
router.use(historicoRoutes);
router.use(registroRoutes);

export default router;
