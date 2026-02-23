// relatorioController.js (melhorado)
import PDFDocument from "pdfkit";
import { supabase } from "../config/supabase.js";

// util para criar ISO UTC start/end para um mês (sem erro de timezone)
function monthRangeISO(ano, mes) {
  // mes: 1-12
  const start = new Date(Date.UTC(ano, mes - 1, 1, 0, 0, 0));
  // se mês = 12, next month = Jan next year
  const nextMonth =
    mes === 12
      ? new Date(Date.UTC(ano + 1, 0, 1, 0, 0, 0))
      : new Date(Date.UTC(ano, mes, 1, 0, 0, 0));
  return { start: start.toISOString(), end: nextMonth.toISOString() };
}

export async function relatorioGanhos(req, res) {
  try {
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);

    if (!mes || !ano || mes < 1 || mes > 12) {
      return res
        .status(400)
        .json({ error: "Mês e ano válidos são obrigatórios" });
    }

    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    const { start, end } = monthRangeISO(ano, mes);

    // SELECT com relacionamento (ajuste os nomes se seu relacionamento tiver outro alias)
    // Tenta trazer cliente.nome e usuario.nome aninhados.
    const { data: vendas = [], error } = await supabase
      .from("registros_vendas")
      .select(
        `
        id,
        valor_total,
        data_venda,
        cliente_id,
        usuario_id,
        clientes ( id, nome ),
        usuarios ( id, nome )
      `,
      )
      .eq("empresa_id", empresaId)
      .gte("data_venda", start)
      .lt("data_venda", end)
      .order("data_venda", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // DEBUG: se quiser inspecionar antes do PDF, retorne json (usar em testes)
    // return res.json({ count: vendas.length, vendas });

    // Caso ainda venha vazio, inspecione vendas aqui no log
    console.log(`Vendas encontradas para ${mes}/${ano}:`, vendas.length);

    // --- Gerar PDF ---
    const doc = new PDFDocument({ margin: 50 });
    const filename = encodeURIComponent(`Relatorio_Ganhos_${mes}_${ano}.pdf`);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);

    doc.fontSize(18).text("Barbearia Lucão", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(14)
      .text(`Relatório de Ganhos - ${mes}/${ano}`, { align: "center" });
    doc.moveDown();

    doc.fontSize(12);
    let totalGeral = 0;

    if (!vendas.length) {
      doc.text("Nenhuma venda encontrada para o período.", { align: "center" });
    } else {
      vendas.forEach((v, index) => {
        const dataBR = new Date(v.data_venda).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        });
        const nomeCliente = v.clientes?.nome || v.cliente_id || "Cliente";
        const nomeUsuario = v.usuarios?.nome || v.usuario_id || "Colaborador";
        const valor = Number(v.valor_total).toFixed(2);
        totalGeral += Number(v.valor_total);

        doc.text(
          `${index + 1}. ${dataBR} - ${nomeCliente} - ${nomeUsuario} - R$ ${valor}`,
        );
      });
    }

    doc.moveDown();
    doc
      .fontSize(14)
      .text(`Total Geral: R$ ${totalGeral.toFixed(2)}`, { align: "right" });

    doc.end();
  } catch (err) {
    console.error("Erro ao gerar relatório:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro ao gerar relatório." });
    }
  }
}
