import { supabase } from "../config/supabase.js";
import { brasiliaISOString } from "../utils/dateUtils.js";

export async function registrarVenda(req, res) {
  const { cliente_id, valor_total, itens, client_reference } = req.body;
  const { forma_pagamento } = req.body; // Adiciona a forma de pagamento

  // validações básicas
  if (
    !cliente_id ||
    !valor_total ||
    !Array.isArray(itens) ||
    itens.length === 0
  ) {
    return res.status(400).json({
      error:
        "Dados incompletos. cliente_id, valor_total e itens são obrigatórios.",
    });
  }

  const valorNum = Number(valor_total);
  if (!Number.isFinite(valorNum) || valorNum <= 0) {
    return res.status(400).json({ error: "valor_total inválido." });
  }

  // Validação da forma de pagamento (já sabemos que existe por causa da validação acima)
  const formasValidas = ["Pix", "Dinheiro", "Credito", "Debito"];
  // Se forma_pagamento for fornecida, ela deve ser válida. Se não for, é opcional.
  if (forma_pagamento && !formasValidas.includes(forma_pagamento)) {
    return res.status(400).json({ error: "Forma de pagamento inválida ou não fornecida." });
  }

  // Garante que se a forma_pagamento for uma string vazia, ela seja salva como null
  const formaPagamentoFinal = forma_pagamento || null;

  for (const it of itens) {
    if (
      typeof it.servico_id === "undefined" ||
      typeof it.valor_cobrado === "undefined"
    ) {
      return res
        .status(400)
        .json({ error: "Cada item precisa ter servico_id e valor_cobrado." });
    }
    if (
      !Number.isFinite(Number(it.valor_cobrado)) ||
      Number(it.valor_cobrado) < 0
    ) {
      return res
        .status(400)
        .json({ error: "valor_cobrado inválido em algum item." });
    }
  }

  try {
    const empresaId = req.usuario?.empresa_id;
    const usuarioId = req.usuario?.id;

    if (!empresaId || !usuarioId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    const dataVenda = brasiliaISOString();

    // ✅ Idempotência por empresa (evita colisão entre empresas)
    if (client_reference) {
      const { data: existing, error: existingErr } = await supabase
        .from("registros_vendas")
        .select("id")
        .eq("client_reference", client_reference)
        .eq("empresa_id", empresaId)
        .limit(1);

      if (existingErr) {
        console.error("Erro checando client_reference:", existingErr);
      } else if (existing?.length) {
        return res.status(200).json({
          message: "Venda já registrada (idempotência)",
          vendaId: existing[0].id,
        });
      }
    }

    // validar cliente pertence à empresa
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("id")
      .eq("id", cliente_id)
      .eq("empresa_id", empresaId)
      .single();

    if (clienteError || !cliente) {
      return res
        .status(400)
        .json({ error: "Cliente inválido ou não pertence à empresa." });
    }

    // ✅ FIX: montar lista única de serviços corretamente
    const servicoIds = [...new Set(itens.map((i) => i.servico_id))];

    const { data: servicosValidos, error: servicosError } = await supabase
      .from("tipos_servicos")
      .select("id")
      .in("id", servicoIds)
      .eq("empresa_id", empresaId);

    if (servicosError) throw servicosError;

    const encontrados = (servicosValidos || []).map((s) => s.id);
    const faltantes = servicoIds.filter((id) => !encontrados.includes(id));

    if (faltantes.length > 0) {
      return res.status(400).json({
        error: `Serviço(s) inválido(s) para esta empresa: ${faltantes.join(", ")}`,
      });
    }

    // inserir venda
    const insertVendaObj = {
      cliente_id,
      usuario_id: usuarioId,
      valor_total: valorNum,
      data_venda: dataVenda,
      empresa_id: empresaId,
      forma_pagamento: formaPagamentoFinal, // Salva a forma de pagamento (pode ser null)
      ...(client_reference ? { client_reference } : {}),
    };

    const { data: vendaData, error: vendaError } = await supabase
      .from("registros_vendas")
      .insert([insertVendaObj])
      .select()
      .single();

    if (vendaError || !vendaData) {
      throw vendaError || new Error("Erro ao criar venda.");
    }

    const vendaId = vendaData.id;

    // montar itens com empresa_id
    const itensInsert = itens.map((item) => ({
      venda_id: vendaId,
      servico_id: item.servico_id,
      valor_cobrado: Number(item.valor_cobrado),
      empresa_id: empresaId,
    }));

    // inserir itens
    const { data: itensCriados, error: itensError } = await supabase
      .from("venda_itens")
      .insert(itensInsert)
      .select();

    if (itensError) {
      // cleanup simples: remover a venda criada para não deixar registro parcial
      try {
        await supabase.from("registros_vendas").delete().eq("id", vendaId);
      } catch (cleanupErr) {
        console.error(
          "Erro durante cleanup de venda após falha em itens:",
          cleanupErr,
        );
      }
      console.error("Erro inserindo itens:", itensError);
      return res
        .status(500)
        .json({ error: "Erro ao inserir itens; venda removida." });
    }

    return res.status(201).json({
      message: "Venda registrada!",
      venda: vendaData,
      itens: itensCriados,
    });
  } catch (error) {
    console.error("registrarVenda error:", error);
    return res.status(500).json({ error: "Erro ao registrar venda." });
  }
}

export async function listarVendas(req, res) {
  try {
    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res.status(401).json({ error: "Token inválido ou sem empresa_id." });
    }

    // A query para o histórico de vendas, agora incluindo forma_pagamento
    const { data, error } = await supabase
      .from("registros_vendas")
      .select(`
        id,
        cliente_id,
        cliente_nome,
        valor_total,
        data_venda,
        forma_pagamento, 
        usuario_id,
        usuarios ( nome )
      `)
      .eq("empresa_id", empresaId)
      .order("data_venda", { ascending: false });

    if (error) throw error;

    // Transforma os dados para corresponder à expectativa do frontend (v.usuario_nome)
    const resultado = data.map(venda => ({
      ...venda,
      usuario_nome: venda.usuarios?.nome
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Erro ao buscar histórico de vendas:", error);
    res.status(500).json({ error: "Erro ao buscar histórico de vendas." });
  }
}

export async function excluirVenda(req, res) {
  try {
    const vendaId = Number(req.params.id);
    if (!vendaId) {
      return res.status(400).json({ error: "ID de venda inválido." });
    }

    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    // Ao configurar a chave estrangeira `venda_itens.venda_id` com `ON DELETE CASCADE`,
    // o banco de dados remove os itens automaticamente ao excluir a venda.
    // Isso simplifica o código, melhora a performance (1 chamada ao DB em vez de 3)
    // e garante a consistência dos dados.
    // A chamada .select() após .delete() retorna os registros excluídos.
    const { data, error } = await supabase
      .from("registros_vendas")
      .delete()
      .eq("id", vendaId)
      .eq("empresa_id", empresaId) // Garante que só pode excluir da própria empresa
      .select();

    if (error) {
      console.error("Erro ao excluir venda:", error);
      return res.status(500).json({ error: "Erro ao excluir a venda." });
    }

    // Se 'data' estiver vazio, o registro não foi encontrado (ou não pertence à empresa)
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Venda não encontrada ou não pertence à sua empresa." });
    }

    return res.status(200).json({ message: "Venda excluída com sucesso." });
  } catch (error) {
    console.error("excluirVenda error:", error);
    return res.status(500).json({ error: "Erro interno ao excluir venda." });
  }
}
