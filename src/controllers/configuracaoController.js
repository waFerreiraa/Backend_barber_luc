import { supabase } from "../config/supabase.js";

// Lista todas as empresas e suas configurações (somente para admin)
export async function listarEmpresasParaAdmin(req, res) {
    try {
    const query = supabase
      .from('empresas')
      .select(`
        id,
        nome,
        empresa_configuracoes (
          id,
          nome_exibicao,
          logo_url,
          cor_primaria,
          cor_secundaria,
          layout_tipo
        )
      `)
      .order('nome', { ascending: true });

    if (req.usuario?.tipo_usuario === 'admin') {
      query.eq('id', req.usuario.empresa_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    // O Supabase retorna a configuração como um array. Vamos simplificar para um objeto.
    const resultado = data.map(empresa => ({
      ...empresa,
      configuracoes: Array.isArray(empresa.empresa_configuracoes)
        ? empresa.empresa_configuracoes[0] || null
        : empresa.empresa_configuracoes,
    }));

    res.json(resultado);
  } catch (error) {
    console.error("Erro ao listar empresas para admin:", error);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
}

// Salva ou atualiza a configuração de uma empresa (somente para admin)
export async function salvarConfiguracao(req, res) {
  const { empresa_id, nome_exibicao, cor_primaria, cor_secundaria, logo_url, layout_tipo } = req.body;

  if (!empresa_id) {
    return res.status(400).json({ error: "O ID da empresa é obrigatório." });
  }

  try {
    // 'upsert' é perfeito aqui: ele cria se não existir, ou atualiza se já existir.
    // A opção 'onConflict' diz qual coluna usar para verificar a existência.
    const { data, error } = await supabase
      .from('empresa_configuracoes')
      .upsert(
        {
          empresa_id,
          nome_exibicao,
          cor_primaria,
          cor_secundaria,
          logo_url: logo_url || null, // Garante que seja null se vazio
          layout_tipo: layout_tipo || 'barbearia',
        },
        {
          onConflict: 'empresa_id',
        }
      )
      .select()
      .single();

    if (error) throw error;

    res.status(200).json(data);
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    res.status(500).json({ error: "Erro interno ao salvar configuração." });
  }
}

export async function uploadLogo(req, res) {
  const { empresaId } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: 'Nenhum arquivo de logo enviado.' });
  }

  try {
    // 1. Define um nome único para o arquivo no Storage
    const fileName = `public/logo_${empresaId}_${Date.now()}`;

    // 2. Faz o upload para o Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('logos') // Nome do bucket que criamos
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Sobrescreve se já existir um com o mesmo nome
      });

    if (uploadError) throw uploadError;

    // 3. Pega a URL pública do arquivo que acabamos de subir
    const { data: urlData } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName);

    // 4. Salva essa URL na tabela de configurações da empresa
    const { data, error: dbError } = await supabase
      .from('empresa_configuracoes')
      .upsert({ empresa_id: empresaId, logo_url: urlData.publicUrl }, { onConflict: 'empresa_id' })
      .select()
      .single();

    if (dbError) throw dbError;

    res.status(200).json(data);
  } catch (error) {
    console.error("Erro no upload do logo:", error);
    res.status(500).json({ error: "Erro interno ao fazer upload do logo." });
  }
}