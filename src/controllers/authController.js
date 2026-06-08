import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from 'crypto';
import { supabase } from "../config/supabase.js";
import { sendPasswordResetEmail } from "../utils/email.js";

// ✅ Agora: apenas ADMIN logado cria usuários na mesma empresa
export async function cadastrarUsuario(req, res) {
  const { nome, email, senha, tipo_usuario } = req.body;

  if (!nome || !email || !senha) {
    return res
      .status(400)
      .json({ error: "Nome, email e senha são obrigatórios" });
  }

  // 🔐 precisa estar autenticado e ter empresa
  const empresaId = req.usuario?.empresa_id;
  const usuarioTipo = req.usuario?.tipo_usuario;

  if (!empresaId) {
    return res.status(401).json({ error: "Token inválido ou sem empresa_id." });
  }

  try {
    const hashSenha = await bcrypt.hash(senha, 10);

    const { data, error } = await supabase
      .from("usuarios")
      .insert([
        {
          nome,
          email,
          senha: hashSenha,
          tipo_usuario: tipo_usuario || "colaborador",
          empresa_id: empresaId, // ✅ FIX: vincula à empresa do admin logado
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);
    // Trata o erro de email duplicado (código '23505' para unique violation no PostgreSQL)
    if (error.code === '23505') {
      return res.status(409).json({ error: "Este email já está em uso." });
    }
    return res.status(500).json({ error: "Erro interno ao cadastrar usuário." });
  }
}

export async function login(req, res) {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: "Email e senha obrigatórios" });
  }

  try {
    const { data: usuario, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: "Email ou senha incorretos" });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Email ou senha incorretos" });
    }

    // 🔐 Segurança: não deixe logar sem empresa_id
    if (!usuario.empresa_id) {
      return res
        .status(403)
        .json({ error: "Usuário sem empresa vinculada. Fale com o admin." });
    }

    // ✅ NOVO: Buscar as configurações da empresa
    const { data: configuracoes, error: configError } = await supabase
      .from("empresa_configuracoes")
      .select("*")
      .eq("empresa_id", usuario.empresa_id)
      .single();

    if (configError) {
      console.warn("Aviso: Empresa não possui configurações de personalização.", configError.message);
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        empresa_id: usuario.empresa_id,
        tipo_usuario: usuario.tipo_usuario,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" },
    );

    return res.json({
      token,
      id: usuario.id,
      nome: usuario.nome,
      tipo_usuario: usuario.tipo_usuario,
      empresa_id: usuario.empresa_id,
      configuracoes: configuracoes || {}, // Envia as configurações para o frontend
    });
  } catch (error) {
    console.error("Erro na função login:", error);
    return res.status(500).json({ error: "Erro interno ao tentar logar." });
  }
}

// NOVO: Listar colaboradores (barbeiros) para agendamento
export async function listarColaboradores(req, res) {
  try {
    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res.status(401).json({ error: "Token inválido ou sem empresa_id." });
    }

    // Busca usuários que são 'colaborador' ou 'admin' na mesma empresa
    const { data: usuarios, error } = await supabase
      .from("usuarios")
      .select("id, nome, tipo_usuario")
      .eq("empresa_id", empresaId)
      .in("tipo_usuario", ["colaborador", "admin"]) // Apenas colaboradores e admins podem ser barbeiros
      .order("nome", { ascending: true });

    if (error) throw error;

    return res.json(usuarios);
  } catch (error) {
    console.error("Erro ao listar colaboradores:", error);
    return res
      .status(500)
      .json({ error: "Erro ao listar colaboradores para agendamento." });
  }
}

// NOVO: Criar usuário (apenas para 'dono')
export async function criarUsuarioPeloDono(req, res) {
  const { nome, email, senha, tipo_usuario, empresa_id } = req.body;

  if (!nome || !email || !senha || !tipo_usuario || !empresa_id) {
    return res
      .status(400)
      .json({ error: "Todos os campos (nome, email, senha, tipo, empresa) são obrigatórios." });
  }

  try {
    const hashSenha = await bcrypt.hash(senha, 10);

    const { data, error } = await supabase
      .from("usuarios")
      .insert([
        {
          nome,
          email,
          senha: hashSenha,
          tipo_usuario: tipo_usuario,
          empresa_id: empresa_id,
        },
      ])
      .select()
      .single();

    if (error) {
        if (error.code === '23505') { // Unique violation for email
            return res.status(409).json({ error: "Este email já está em uso." });
        }
        throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    console.error("Erro ao criar usuário pelo dono:", err);
    return res.status(500).json({ error: "Erro interno ao criar usuário." });
  }
}

// ✅ NOVO: Função para o próprio usuário alterar sua senha
export async function alterarSenha(req, res) {
  const { senha_antiga, nova_senha } = req.body;
  const usuarioId = req.usuario.id; // Pega o ID do usuário logado (do token)

  if (!senha_antiga || !nova_senha) {
    return res.status(400).json({ error: "Senha antiga e nova senha são obrigatórias." });
  }

  if (nova_senha.length < 6) {
      return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
  }

  try {
    // 1. Buscar o usuário e sua senha atual
    const { data: usuario, error: fetchError } = await supabase
      .from("usuarios")
      .select("senha")
      .eq("id", usuarioId)
      .single();

    if (fetchError || !usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // 2. Verificar se a senha antiga está correta
    const senhaCorreta = await bcrypt.compare(senha_antiga, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Senha antiga incorreta." });
    }

    // 3. Gerar o hash da nova senha e atualizar no banco
    const hashNovaSenha = await bcrypt.hash(nova_senha, 10);
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ senha: hashNovaSenha })
      .eq("id", usuarioId);

    if (updateError) throw updateError;

    res.status(200).json({ message: "Senha alterada com sucesso." });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    res.status(500).json({ error: "Erro interno ao alterar a senha." });
  }
}

// ✅ NOVO: Função para o próprio usuário alterar seu email
export async function alterarEmail(req, res) {
  const { novo_email, senha } = req.body;
  const usuarioId = req.usuario.id;

  if (!novo_email || !senha) {
    return res.status(400).json({ error: "O novo email e a senha atual são obrigatórios." });
  }

  try {
    // 1. Verificar se o novo email já está em uso
    const { data: emailExists, error: emailExistsError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", novo_email)
      .neq("id", usuarioId) // Ignora o próprio usuário na verificação
      .single();

    if (emailExistsError && emailExistsError.code !== 'PGRST116') { // PGRST116 = 'exact-one' row not found, which is good here
        throw emailExistsError;
    }
    if (emailExists) {
      return res.status(409).json({ error: "Este email já está em uso por outra conta." });
    }

    // 2. Buscar o usuário e sua senha atual
    const { data: usuario, error: fetchError } = await supabase
      .from("usuarios")
      .select("senha")
      .eq("id", usuarioId)
      .single();

    if (fetchError || !usuario) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // 3. Verificar se a senha atual está correta
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Senha atual incorreta." });
    }

    // 4. Atualizar o email no banco
    const { error: updateError } = await supabase.from("usuarios").update({ email: novo_email }).eq("id", usuarioId);

    if (updateError) throw updateError;

    res.status(200).json({ message: "Email alterado com sucesso." });
  } catch (error) {
    console.error("Erro ao alterar email:", error);
    res.status(500).json({ error: "Erro interno ao alterar o email." });
  }
}

// ✅ NOVO: Função para solicitar a redefinição de senha
export async function solicitarResetSenha(req, res) {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "O email é obrigatório." });
  }

  try {
    const { data: usuario, error: fetchError } = await supabase
      .from("usuarios")
      .select("id, email, empresa_id") // Pega o ID da empresa do usuário
      .eq("email", email)
      .single();

    if (fetchError || !usuario) {
      // Mesmo que o usuário não exista, retornamos sucesso para não revelar informações.
      return res.status(200).json({ message: "Se um usuário com este email existir, um link de redefinição foi enviado." });
    }

    // Busca o nome da empresa para personalizar o remetente do email
    let nomeEmpresa = "Barbearia Digital"; // Nome padrão caso nada seja encontrado
    if (usuario.empresa_id) {
      const { data: config } = await supabase
        .from('empresa_configuracoes')
        .select('nome_exibicao')
        .eq('empresa_id', usuario.empresa_id)
        .single();

      if (config?.nome_exibicao) {
        nomeEmpresa = config.nome_exibicao;
      } else {
        // Se não houver configuração, busca o nome original da empresa como fallback
        const { data: empresa } = await supabase
          .from('empresas')
          .select('nome')
          .eq('id', usuario.empresa_id)
          .single();

        if (empresa?.nome) {
          nomeEmpresa = empresa.nome;
        }
      }
    }

    // Gerar token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Definir data de expiração (e.g., 1 hora)
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    // Salvar token e data de expiração no usuário
    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ reset_password_token: hashToken, reset_password_expires: expires.toISOString() })
      .eq("id", usuario.id);

    if (updateError) throw updateError;

    // Envia o email, passando o nome da empresa para ser usado como remetente
    await sendPasswordResetEmail(usuario.email, resetToken, nomeEmpresa);

    res.status(200).json({ message: "Se um usuário com este email existir, um link de redefinição foi enviado." });

  } catch (error) {
    console.error("Erro ao solicitar reset de senha:", error);
    // Não retorne o erro detalhado para o cliente por segurança
    res.status(500).json({ error: "Ocorreu um erro no servidor." });
  }
}

// ✅ NOVO: Função para redefinir a senha com o token
export async function resetarSenha(req, res) {
  const { token, nova_senha } = req.body;

  if (!token || !nova_senha) {
    return res.status(400).json({ error: "Token e nova senha são obrigatórios." });
  }

  const hashToken = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const { data: usuario, error: fetchError } = await supabase
      .from("usuarios")
      .select("id")
      .eq("reset_password_token", hashToken)
      .gt("reset_password_expires", new Date().toISOString()) // Checa se o token não expirou
      .single();

    if (fetchError || !usuario) {
      return res.status(400).json({ error: "Token de redefinição inválido ou expirado." });
    }

    const hashNovaSenha = await bcrypt.hash(nova_senha, 10);

    const { error: updateError } = await supabase
      .from("usuarios")
      .update({ senha: hashNovaSenha, reset_password_token: null, reset_password_expires: null })
      .eq("id", usuario.id);

    if (updateError) throw updateError;

    res.status(200).json({ message: "Senha redefinida com sucesso." });
  } catch (error) {
    console.error("Erro ao redefinir senha:", error);
    res.status(500).json({ error: "Erro interno ao redefinir a senha." });
  }
}
