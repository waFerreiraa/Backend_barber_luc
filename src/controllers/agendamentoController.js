import { supabase } from "../config/supabase.js";
import { brasiliaISOString } from "../utils/dateUtils.js"; // Reutilizando sua função

// Função auxiliar para verificar sobreposição de horários
async function verificarConflitoDeHorario(
  usuario_id,
  empresa_id,
  data_hora_inicio_novo, // Renomeado para clareza
  data_hora_fim_novo,     // Renomeado para clareza
  agendamento_id = null,
) {
  let query = supabase
    .from("agendamentos")
    .select("id")
    .eq("usuario_id", usuario_id)
    .eq("empresa_id", empresa_id)
    .neq("status", "cancelado"); // Não considerar agendamentos cancelados

  // Condição para sobreposição: (agendamento_existente.inicio < novo.fim) AND (agendamento_existente.fim > novo.inicio)
  query = query.lt("data_hora_inicio", data_hora_fim_novo);
  query = query.gt("data_hora_fim", data_hora_inicio_novo);

  if (agendamento_id) {
    query = query.neq("id", agendamento_id); // Excluir o próprio agendamento ao atualizar
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.length > 0; // Retorna true se houver conflito
}

export async function listarAgendamentos(req, res) {
  try {
    const empresaId = req.usuario?.empresa_id;
    const usuarioId = req.usuario?.id;
    const tipoUsuario = req.usuario?.tipo_usuario;

    if (!empresaId || !usuarioId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    let query = supabase
      .from("agendamentos")
      .select(
        `
        id,
        data_hora_inicio,
        data_hora_fim,
        cliente_nome,
        servico_nome,
        servico_duracao_minutos,
        status,
        observacoes,
        usuarios(id, nome)
      `,
      )
      .eq("empresa_id", empresaId)
      .order("data_hora_inicio", { ascending: true });

    // Se não for admin, mostra apenas os agendamentos do próprio usuário
    if (tipoUsuario !== "admin") {
      query = query.eq("usuario_id", usuarioId);
    }

    // Filtros opcionais por query params
    const { start, end, colaborador_id } = req.query; // Removido cliente_id
    if (start) query = query.gte("data_hora_inicio", start);
    if (end) query = query.lte("data_hora_fim", end);
    if (colaborador_id) query = query.eq("usuario_id", colaborador_id);

    const { data, error } = await query;

    if (error) throw error;

    return res.json(data);
  } catch (error) {
    console.error("Erro ao listar agendamentos:", error);
    return res.status(500).json({ error: "Erro ao listar agendamentos." });
  }
}

export async function criarAgendamento(req, res) {
  const { cliente_nome, usuario_id: raw_usuario_id, servico_nome, servico_duracao_minutos, data_hora_inicio, observacoes } = req.body;

  if (!cliente_nome || !raw_usuario_id || !servico_nome || !servico_duracao_minutos || !data_hora_inicio) {
    return res
      .status(400)
      .json({ error: "Nome do cliente, barbeiro, nome do serviço, duração do serviço e data/hora são obrigatórios." });
  }

  try {
    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    // Validação da duração do serviço
    const duracao = Number(servico_duracao_minutos);
    if (!Number.isInteger(duracao) || duracao <= 0) {
      return res.status(400).json({ error: "Duração do serviço inválida. Deve ser um número inteiro positivo." });
    }

    const usuario_id = Number(raw_usuario_id); // Converte para número
    if (isNaN(usuario_id) || usuario_id <= 0) {
      return res.status(400).json({ error: "ID do barbeiro inválido." });
    }

    // FIX: Trata a data de entrada como sendo do fuso de Brasília (UTC-3)
    // Isso garante que "15:00" seja salvo como 15:00 de Brasília, não importa o fuso do servidor.
    const inicio = new Date(`${data_hora_inicio}-03:00`);
    if (isNaN(inicio.getTime())) {
      return res.status(400).json({ error: "Formato de data/hora inválido." });
    }
    const fim = new Date(inicio.getTime() + duracao * 60 * 1000);

    // 2. Verificar conflito de horário para o barbeiro
    // Usa o usuario_id já convertido para número
    const temConflito = await verificarConflitoDeHorario(
      usuario_id,
      empresaId,
      inicio.toISOString(),
      fim.toISOString(),
    );

    if (temConflito) {
      return res
        .status(409)
        .json({ error: "O barbeiro já tem um agendamento neste horário." });
    }

    // 3. Criar agendamento
    const { data: agendamentoData, error: agendamentoError } = await supabase
      .from("agendamentos")
      .insert([
        {
          cliente_nome,
          usuario_id, // Usa o usuario_id já convertido para número
          servico_nome,
          servico_duracao_minutos: duracao,
          empresa_id: empresaId,
          data_hora_inicio: inicio.toISOString(),
          data_hora_fim: fim.toISOString(),
          observacoes,
          status: "agendado",
        },
      ])
      .select()
      .single();

    if (agendamentoError) throw agendamentoError;

    return res.status(201).json(agendamentoData);
  } catch (error) {
    console.error("Erro ao criar agendamento:", error);
    return res.status(500).json({ error: "Erro ao criar agendamento." });
  }
}

export async function atualizarAgendamento(req, res) {
  const id = Number(req.params.id); // Converte para número
  const { cliente_nome, usuario_id: raw_usuario_id, servico_nome, servico_duracao_minutos, data_hora_inicio, status, observacoes } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID do agendamento é obrigatório." });
  }

  try {
    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    const usuario_id = Number(raw_usuario_id); // Converte para número
    if (isNaN(usuario_id) || usuario_id <= 0) {
      return res.status(400).json({ error: "ID do barbeiro inválido." });
    }


    // Validação da duração do serviço
    const duracao = Number(servico_duracao_minutos);
    if (!Number.isInteger(duracao) || duracao <= 0) {
      return res.status(400).json({ error: "Duração do serviço inválida. Deve ser um número inteiro positivo." });
    }

    // Se data_hora_inicio for fornecida, recalcula o fim
    // Caso contrário, mantém o fim existente (ou assume que a duração não mudou)

    // FIX: Trata a data de entrada como sendo do fuso de Brasília (UTC-3)
    const inicio = data_hora_inicio ? new Date(`${data_hora_inicio}-03:00`) : null;
    if (data_hora_inicio && isNaN(inicio.getTime())) {
      return res.status(400).json({ error: "Formato de data/hora inválido." });
    }

    const fim = inicio ? new Date(inicio.getTime() + duracao * 60 * 1000) : null;

    // Verificar conflito de horário se data/hora ou barbeiro for alterado
    if (inicio && usuario_id) {
      const temConflito = await verificarConflitoDeHorario(
        // Usa o usuario_id já convertido para número
        usuario_id,
        empresaId,
        inicio.toISOString(),
        fim.toISOString(),
        id, // Passa o ID do agendamento para ignorá-lo na verificação
      );
      if (temConflito) {
        return res
          .status(409)
          .json({ error: "O barbeiro já tem um agendamento neste horário." });
      }
    }

    const { data, error } = await supabase
      .from("agendamentos")
      .update({
        cliente_nome,
        usuario_id, // Usa o usuario_id já convertido para número
        servico_nome,
        servico_duracao_minutos: duracao,
        data_hora_inicio: inicio?.toISOString(),
        data_hora_fim: fim?.toISOString(),
        status,
        observacoes,
      })
      .eq("id", id)
      .eq("empresa_id", empresaId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: "Agendamento não encontrado ou não pertence à sua empresa." });
    }

    return res.json(data);
  } catch (error) {
    console.error("Erro ao atualizar agendamento:", error);
    return res.status(500).json({ error: "Erro ao atualizar agendamento." });
  }
}

export async function excluirAgendamento(req, res) {
  const id = Number(req.params.id); // Converte para número

  if (!id) {
    return res.status(400).json({ error: "ID do agendamento é obrigatório." });
  }

  try {
    const empresaId = req.usuario?.empresa_id;
    if (!empresaId) {
      return res
        .status(401)
        .json({ error: "Token inválido ou sem empresa_id." });
    }

    const { error } = await supabase
      .from("agendamentos")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) throw error;

    return res.status(204).send(); // No Content
  } catch (error) {
    console.error("Erro ao excluir agendamento:", error);
    return res.status(500).json({ error: "Erro ao excluir agendamento." });
  }
}