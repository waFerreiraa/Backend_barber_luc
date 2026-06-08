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
  const { nome, valor_padrao} = req.body; // Adicionado duracao_minutos

  if (!nome || !valor_padrao) {
    return res.status(400).json({ error: "Nome e valor são obrigatórios" });
  }

  try {
    // Validação para duracao_minutos (opcional, default 30)
    // FIX: Converte o valor para número e valida
    const valorNumerico = parseFloat(valor_padrao);
    if (isNaN(valorNumerico) || valorNumerico < 0) {
      return res.status(400).json({ error: "Valor do serviço inválido. Deve ser um número positivo." });
    }

    const { data, error } = await supabase
      .from("tipos_servicos")
      .insert([
        {
          nome,
          valor_padrao: valorNumerico,
          empresa_id: req.usuario.empresa_id // 🔐 obrigatório
        },
      ])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (error) {
    console.error("Erro ao adicionar serviço:", error); // Adiciona log para depuração
    // ✅ NOVO: Trata o erro de nome duplicado (código '23505' para unique violation)
    if (error.code === '23505') {
      return res.status(409).json({ error: `O serviço com o nome "${nome}" já existe.` });
    }
    res.status(500).json({ error: "Erro interno ao adicionar serviço." });
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
    
    // Sugestão: Adicionar a mesma validação de valor que existe na criação
    const valorNumerico = parseFloat(valor_padrao);
    if (isNaN(valorNumerico) || valorNumerico < 0) {
      return res.status(400).json({ error: "Valor do serviço inválido. Deve ser um número positivo." });
    }

    const { data, error } = await supabase
      .from("tipos_servicos")
      // Garante que o valor salvo no banco seja sempre um número
      .update({ nome, valor_padrao: valorNumerico })
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
    // ✅ NOVO: Trata o erro de nome duplicado
    if (error.code === '23505') {
      return res.status(409).json({ error: `O serviço com o nome "${nome}" já existe.` });
    }
    res.status(500).json({ error: "Erro interno ao atualizar serviço." });
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

    // Sugestão: Unificar a exclusão e verificação em uma única chamada
    const { data, error } = await supabase
      .from("tipos_servicos")
      .delete()
      .eq("id", servicoId)
      .eq("empresa_id", empresaId) // Garante que só pode excluir serviços da própria empresa
      .select(); // .select() retorna os itens deletados

    if (error) throw error;

    // Se 'data' estiver vazio, significa que nenhum registro correspondeu aos critérios (id e empresa_id)
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Serviço não encontrado ou não pertence à sua empresa." });
    }

    res.status(204).send(); // 204 No Content para exclusão bem-sucedida
  } catch (error) {
    console.error("Erro ao excluir serviço:", error);
    res.status(500).json({ error: "Erro ao excluir serviço." });
  }
}
