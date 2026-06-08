import { Router } from 'express';
import multer from 'multer';
import { autenticar } from "../middlewares/authMiddleware.js";
import { ownerOnly } from '../middlewares/adminMiddleware.js';
import { listarEmpresasParaAdmin, salvarConfiguracao, uploadLogo } from '../controllers/configuracaoController.js';
import { criarUsuarioPeloDono } from '../controllers/authController.js';

const router = Router();

// Configuração do Multer para usar a memória (não salva arquivos no servidor)
const upload = multer({ storage: multer.memoryStorage() });

// Rotas de administração de configurações
// Protegidas para garantir que apenas usuários autenticados e com permissão possam acessar
router.get('/admin/empresas-config', autenticar, ownerOnly, listarEmpresasParaAdmin);
router.post('/admin/empresas-config', autenticar, ownerOnly, salvarConfiguracao);
router.post('/admin/usuarios', autenticar, ownerOnly, criarUsuarioPeloDono);
router.post('/admin/empresas-config/:empresaId/logo', autenticar, ownerOnly, upload.single('logo'), uploadLogo);

export default router;