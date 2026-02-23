import { supabase } from "../config/supabase.js";
import { brasiliaISOString } from "../utils/dateUtils.js";

export async function registrarVenda(req, res) {
  const { cliente_id, valor_total, itens, client_reference } = req.body;

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

    // verifica se a venda pertence à empresa
    const { data: venda, error: vendaErr } = await supabase
      .from("registros_vendas")
      .select("id")
      .eq("id", vendaId)
      .eq("empresa_id", empresaId)
      .single();

    if (vendaErr || !venda) {
      return res.status(404).json({ error: "Venda não encontrada." });
    }

    // deleta itens relacionados (cleanup)
    const { error: delItensErr } = await supabase
      .from("venda_itens")
      .delete()
      .eq("venda_id", vendaId)
      .eq("empresa_id", empresaId);

    if (delItensErr) {
      console.error("Erro deletando itens da venda:", delItensErr);
      // prosseguir tentando deletar a venda mesmo assim
    }

    // deleta a venda
    const { error: delVendaErr } = await supabase
      .from("registros_vendas")
      .delete()
      .eq("id", vendaId)
      .eq("empresa_id", empresaId);

    if (delVendaErr) {
      console.error("Erro deletando venda:", delVendaErr);
      return res.status(500).json({ error: "Erro ao deletar venda." });
    }

    return res.status(200).json({ message: "Venda excluída com sucesso." });
  } catch (error) {
    console.error("excluirVenda error:", error);
    return res.status(500).json({ error: "Erro interno ao excluir venda." });
  }
}
