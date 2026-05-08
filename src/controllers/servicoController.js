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

// NOVO: Função para atualizar um serviço existente
export async function atualizarServico(req, res) {
  const servicoId = req.params.id;
  const { nome, valor_padrao } = req.body;

  if (!servicoId || !nome || !valor_padrao) {
    return res.status(400).json({ error: "ID do serviço, nome e valor são obrigatórios." });
  }

  try {
    const empresaId = req.usuario.empresa_id;

    const { data, error } = await supabase
      .from("tipos_servicos")
      .update({ nome, valor_padrao })
      .eq("id", servicoId)
      .eq("empresa_id", empresaId) // Garante que só pode editar serviços da própria empresa
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Serviço não encontrado ou não pertence à sua empresa." });
    }

    res.json(data);
  } catch (error) {
    console.error("Erro ao atualizar serviço:", error);
    res.status(500).json({ error: "Erro ao atualizar serviço." });
  }
}

// NOVO: Função para excluir um serviço
export async function excluirServico(req, res) {
  const servicoId = req.params.id;

  if (!servicoId) {
    return res.status(400).json({ error: "ID do serviço é obrigatório." });
  }

  try {
    const empresaId = req.usuario.empresa_id;

    // Primeiro, verificar se o serviço existe e pertence à empresa
    const { data: existingService, error: fetchError } = await supabase
      .from("tipos_servicos")
      .select("id")
      .eq("id", servicoId)
      .eq("empresa_id", empresaId)
      .single();

    if (fetchError || !existingService) {
      return res.status(404).json({ error: "Serviço não encontrado ou não pertence à sua empresa." });
    }

    // Se não estiver em uso, pode excluir
    const { error } = await supabase
      .from("tipos_servicos")
      .delete()
      .eq("id", servicoId)
      .eq("empresa_id", empresaId); // Garante que só pode excluir serviços da própria empresa

    if (error) throw error;

    res.status(204).send(); // 204 No Content para exclusão bem-sucedida
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({ error: "Erro ao excluir serviço." });
  }
}
