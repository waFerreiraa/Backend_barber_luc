import { supabase } from "../config/supabase.js";
import { brasiliaISOString } from "../utils/dateUtils.js";

export async function buscarSumario(req, res) {
  try {
   let query = supabase
  .from("registros_vendas")
  .select("valor_total, data_venda")
  .eq("empresa_id", req.usuario.empresa_id);

    if (req.usuario.tipo_usuario !== "admin") {
      query = query.eq("usuario_id", req.usuario.id);
    }

    const { data: vendas } = await query;

    const hoje = new Date(brasiliaISOString());

    const faturamentoDia = vendas
      .filter(
        (v) => new Date(v.data_venda).toDateString() === hoje.toDateString(),
      )
      .reduce((acc, v) => acc + Number(v.valor_total), 0);

    const faturamentoMes = vendas
      .filter((v) => {
        const d = new Date(v.data_venda);
        return (
          d.getMonth() === hoje.getMonth() &&
          d.getFullYear() === hoje.getFullYear()
        );
      })
      .reduce((acc, v) => acc + Number(v.valor_total), 0);

    res.json({ faturamentoDia, faturamentoMes });
  } catch {
    res.status(500).json({ error: "Erro ao buscar sumário." });
  }
}
