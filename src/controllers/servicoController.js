import { supabase } from "../config/supabase.js";

export async function listarServicos(req, res) {
  try {
    const { data, error } = await supabase
      .from("tipos_servicos")
      .select("*")
      .eq("empresa_id", req.usuario.empresa_id) // 🔐 isolamento
      .order("nome");

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar serviços." });
  }
}

export async function criarServico(req, res) {
  const { nome, valor_padrao } = req.body;

  if (!nome || !valor_padrao) {
    return res.status(400).json({ error: "Nome e valor são obrigatórios" });
  }

  try {
    const { data, error } = await supabase
      .from("tipos_servicos")
      .insert([
        {
          nome,
          valor_padrao,
          empresa_id: req.usuario.empresa_id, // 🔐 obrigatório
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    res.status(500).json({ error: "Erro ao adicionar serviço." });
  }
}
