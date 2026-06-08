import { supabase } from "../config/supabase.js";

export async function buscarHistorico(req, res) {
  try {
    const empresaId = req.usuario.empresa_id;

    let query = supabase
      .from("registros_vendas")
      .select(
        `
        id,
        valor_total,
        data_venda,
        forma_pagamento,
        usuario_id,
        empresa_id,
        usuarios!inner(nome),
        clientes!inner(nome),
        venda_itens(
          id,
          valor_cobrado,
          tipos_servicos!inner(nome)
        )
      `
      )
      .eq("empresa_id", empresaId) // ✅ isolamento obrigatório
      .order("data_venda", { ascending: false });

    // colaborador vê só as próprias vendas
    if (req.usuario.tipo_usuario !== "admin") {
      query = query.eq("usuario_id", req.usuario.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    const vendasFormatadas = (data || []).map((v) => ({
      ...v,
      usuario_nome: v.usuarios?.nome || null,
      cliente_nome: v.clientes?.nome || null,
    }));

    return res.json(vendasFormatadas);
  } catch (err) {
    console.error(err);
    console.error("Erro ao buscar histórico no Supabase:", err); // Log mais detalhado
    return res.status(500).json({ error: "Erro ao buscar histórico." });
  }
}