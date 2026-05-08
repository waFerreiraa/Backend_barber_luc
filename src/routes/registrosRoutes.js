// routes/registroRoutes.js
import { Router } from "express";
import { registroInicial } from "../controllers/registroController.js";

const router = Router();

// POST /api/registro  -> cria empresa + admin e retorna token
router.post("/registro", registroInicial);

export default router;