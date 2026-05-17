import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js";

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

  if (usuarioTipo !== "admin") {
    return res
      .status(403)
      .json({ error: "Apenas admin pode cadastrar usuários." });
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
  } catch (err) {
    // dica: email duplicado normalmente cai aqui
    return res.status(500).json({ error: "Erro ao cadastrar usuário" });
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
    });
  } catch {
    return res.status(500).json({ error: "Erro ao tentar logar" });
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
