// controllers/registroController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/supabase.js"; // seu client server-side
// certifique-se que esse supabase tenha service_role key no servidor

const JWT_SECRET = process.env.JWT_SECRET || "troque_isso_no_producao";
const JWT_EXPIRES_IN = "30d"; // ajuste conforme desejar

export async function registroInicial(req, res) {
  try {
    const { empresa_nome, nome, email, senha, layout_tipo } = req.body;

    // validação simples
    if (!empresa_nome || !nome || !email || !senha || !layout_tipo) {
      return res.status(400).json({ error: "Todos os campos são obrigatórios." });
    }

    // checar se email já existe (globalmente)
    const { data: userExists, error: userExistsErr } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", email)
      .limit(1);

    if (userExistsErr) {
      console.error("Erro checando email existente:", userExistsErr);
      return res.status(500).json({ error: "Erro interno." });
    }
    if (userExists?.length) {
      return res.status(400).json({ error: "E-mail já cadastrado." });
    }

    // 1) criar empresa
    const { data: empresaData, error: empresaErr } = await supabase
      .from("empresas")
      .insert([{ nome: empresa_nome }])
      .select()
      .single();

    if (empresaErr || !empresaData) {
      console.error("Erro criando empresa:", empresaErr);
      return res.status(500).json({ error: "Erro ao criar empresa." });
    }

    const empresaId = empresaData.id;

    // ✅ NOVO: Criar a configuração da empresa com o tipo de layout
    const { error: configError } = await supabase
      .from("empresa_configuracoes")
      .insert([{
        empresa_id: empresaId,
        nome_exibicao: empresa_nome,
        layout_tipo: layout_tipo || 'barbearia', // Garante um padrão
      }]);

    if (configError) {
      console.error("Erro ao criar configuração da empresa:", configError);
      // Cleanup: remove a empresa recém-criada se a configuração falhar
      await supabase.from("empresas").delete().eq("id", empresaId);
      return res.status(500).json({ error: "Erro ao configurar a empresa." });
    }


    // 2) criar usuário admin vinculado
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(senha, salt);

    const usuarioPayload = {
      nome,
      email,
      senha: hashed,
      tipo_usuario: "admin",
      empresa_id: empresaId,
      data_criacao: new Date().toISOString(),
    };

    const { data: usuarioData, error: usuarioErr } = await supabase
      .from("usuarios")
      .insert([usuarioPayload])
      .select("id, nome, email, tipo_usuario, empresa_id")
      .single();

    if (usuarioErr || !usuarioData) {
      console.error("Erro criando usuário:", usuarioErr);

      // cleanup: remover empresa criada para não deixar órfãos
      try {
        await supabase.from("empresas").delete().eq("id", empresaId);
        // A configuração será removida em cascata pelo 'ON DELETE CASCADE' no banco
      } catch (cleanupErr) {
        console.error("Erro no cleanup empresa:", cleanupErr);
      }

      return res.status(500).json({ error: "Erro ao criar usuário." });
    }

    // 3) gerar token JWT (payload mínimo)
    const tokenPayload = {
      id: usuarioData.id,
      empresa_id: usuarioData.empresa_id,
      tipo_usuario: usuarioData.tipo_usuario,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // retornar token + dados do usuário (sem senha)
    return res.status(201).json({
      token,
      id: usuarioData.id,
      nome: usuarioData.nome,
      email: usuarioData.email,
      tipo_usuario: usuarioData.tipo_usuario,
      empresa_id: usuarioData.empresa_id,
    });
  } catch (err) {
    console.error("registroInicial error:", err);
    return res.status(500).json({ error: "Erro interno ao registrar." });
  }
}