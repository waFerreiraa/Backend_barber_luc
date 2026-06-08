import { Router } from 'express';
import { autenticar, verificarAdmin } from '../middlewares/authMiddleware.js';
import { cadastrarUsuario } from '../controllers/authController.js';

const router = Router();

// Rota para admin/dono criar um novo usuário (colaborador/admin) na sua própria empresa
router.post('/api/usuarios', autenticar, verificarAdmin, cadastrarUsuario);

export default router;