// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// --- 2. MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- 3. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://viltdxuuyerlsctfhgfb.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY; // Coloque aqui sua chave anon ou service_role
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 4. ROTAS DA API ---

// Clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

app.post('/api/clientes', async (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    const { data, error } = await supabase
      .from('clientes')
      .insert([{ nome, telefone }])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar cliente.' });
  }
});

// Tipos de serviço
app.get('/api/tipos_servicos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tipos_servicos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tipos de serviços.' });
  }
});

app.post('/api/tipos_servicos', async (req, res) => {
  const { nome, valor_padrao } = req.body;
  if (!nome || !valor_padrao) return res.status(400).json({ error: 'Nome e valor são obrigatórios.' });

  try {
    const { data, error } = await supabase
      .from('tipos_servicos')
      .insert([{ nome, valor_padrao }])
      .select();

    if (error) throw error;

    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao adicionar tipo de serviço.' });
  }
});

// Registrar venda
app.post('/api/vendas', async (req, res) => {
  const { cliente_id, valor_total, itens } = req.body;
  if (!cliente_id || !valor_total || !itens || itens.length === 0)
    return res.status(400).json({ error: 'Dados incompletos para registrar a venda.' });

  try {
    // Insere registro de venda
    const { data: vendaData, error: vendaError } = await supabase
      .from('registros_vendas')
      .insert([{ cliente_id, valor_total }])
      .select();

    if (vendaError) throw vendaError;

    const vendaId = vendaData[0].id;

    // Insere itens da venda
    const itensInsert = itens.map(item => ({
      venda_id: vendaId,
      servico_id: item.servico_id,
      valor_cobrado: item.valor_cobrado
    }));

    const { error: itensError } = await supabase
      .from('venda_itens')
      .insert(itensInsert);

    if (itensError) throw itensError;

    res.status(201).json({ message: 'Venda registrada com sucesso!', vendaId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao registrar a venda.' });
  }
});

// Histórico de vendas
app.get('/api/historico', async (req, res) => {
  try {
    const { data: vendas, error: vendasError } = await supabase
      .from('registros_vendas')
      .select(`
        id,
        valor_total,
        data_venda,
        clientes!inner(nome)
      `)
      .order('data_venda', { ascending: false });

    if (vendasError) throw vendasError;

    const historico = [];

    for (const venda of vendas) {
      const { data: itens, error: itensError } = await supabase
        .from('venda_itens')
        .select('id, valor_cobrado, tipos_servicos!inner(nome)')
        .eq('venda_id', venda.id);

      if (itensError) throw itensError;

      historico.push({
        id: venda.id,
        valor_total: venda.valor_total,
        data_venda: venda.data_venda,
        cliente_nome: venda.clientes.nome,
        itens: itens.map(i => ({
          id: i.id,
          valor_cobrado: i.valor_cobrado,
          servico_nome: i.tipos_servicos.nome
        }))
      });
    }

    res.json(historico);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// Sumário de faturamento
app.get('/api/sumario', async (req, res) => {
  try {
    const { data: diaData, error: diaError } = await supabase
      .from('registros_vendas')
      .select('valor_total')
      .eq('data_venda', new Date().toISOString().split('T')[0]);

    if (diaError) throw diaError;

    const faturamentoDia = diaData.reduce((acc, v) => acc + Number(v.valor_total), 0);

    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    const { data: mesData, error: mesError } = await supabase
      .from('registros_vendas')
      .select('valor_total')
      .gte('data_venda', `${ano}-${mes.toString().padStart(2,'0')}-01`)
      .lte('data_venda', `${ano}-${mes.toString().padStart(2,'0')}-31`);

    if (mesError) throw mesError;

    const faturamentoMes = mesData.reduce((acc, v) => acc + Number(v.valor_total), 0);

    res.json({ faturamentoDia, faturamentoMes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar o sumário.' });
  }
});

// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
