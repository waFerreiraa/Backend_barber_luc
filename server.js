// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg'); // PostgreSQL
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- 2. MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- 3. CONEXÃO COM O BANCO DE DADOS POSTGRESQL ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // necessário para Render/Postgres remoto
});

pool.connect()
  .then(() => console.log('✅ Conectado com sucesso ao PostgreSQL!'))
  .catch(err => console.error('❌ Erro ao conectar ao PostgreSQL:', err));

// --- 4. ROTAS DA API ---

// Clientes
app.get('/api/clientes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

app.post('/api/clientes', async (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome é obrigatório.' });

  try {
    const result = await pool.query(
      'INSERT INTO clientes (nome, telefone) VALUES ($1, $2) RETURNING *',
      [nome, telefone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao adicionar cliente.' });
  }
});

// Tipos de serviço
app.get('/api/tipos_servicos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tipos_servicos ORDER BY nome');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar tipos de serviços.' });
  }
});

app.post('/api/tipos_servicos', async (req, res) => {
  const { nome, valor_padrao } = req.body;
  if (!nome || !valor_padrao) return res.status(400).json({ error: 'Nome e valor são obrigatórios.' });

  try {
    const result = await pool.query(
      'INSERT INTO tipos_servicos (nome, valor_padrao) VALUES ($1, $2) RETURNING *',
      [nome, valor_padrao]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao adicionar tipo de serviço.' });
  }
});

// Registrar venda
app.post('/api/vendas', async (req, res) => {
  const { cliente_id, valor_total, itens } = req.body;
  if (!cliente_id || !valor_total || !itens || itens.length === 0)
    return res.status(400).json({ error: 'Dados incompletos para registrar a venda.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resultVenda = await client.query(
      'INSERT INTO registros_vendas (cliente_id, valor_total) VALUES ($1, $2) RETURNING id',
      [cliente_id, valor_total]
    );

    const vendaId = resultVenda.rows[0].id;

    for (const item of itens) {
      await client.query(
        'INSERT INTO venda_itens (venda_id, servico_id, valor_cobrado) VALUES ($1, $2, $3)',
        [vendaId, item.servico_id, item.valor_cobrado]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Venda registrada com sucesso!', vendaId });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Erro ao registrar a venda.' });
  } finally {
    client.release();
  }
});

// Histórico de vendas
app.get('/api/historico', async (req, res) => {
  try {
    const vendasResult = await pool.query(`
      SELECT rv.id, rv.valor_total, rv.data_venda, c.nome AS cliente_nome
      FROM registros_vendas rv
      JOIN clientes c ON rv.cliente_id = c.id
      ORDER BY rv.data_venda DESC
    `);

    const vendas = [];

    for (const venda of vendasResult.rows) {
      const itensResult = await pool.query(`
        SELECT vi.id, ts.nome AS servico_nome, vi.valor_cobrado
        FROM venda_itens vi
        JOIN tipos_servicos ts ON vi.servico_id = ts.id
        WHERE vi.venda_id = $1
      `, [venda.id]);

      vendas.push({
        ...venda,
        itens: itensResult.rows,
        data_venda: new Date(venda.data_venda).toISOString()
      });
    }

    res.json(vendas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
});

// Sumário de faturamento
app.get('/api/sumario', async (req, res) => {
  try {
    const diaResult = await pool.query(
      `SELECT COALESCE(SUM(valor_total),0) as total 
       FROM registros_vendas 
       WHERE DATE(data_venda) = CURRENT_DATE`
    );

    const mesResult = await pool.query(
      `SELECT COALESCE(SUM(valor_total),0) as total 
       FROM registros_vendas 
       WHERE EXTRACT(YEAR FROM data_venda) = EXTRACT(YEAR FROM CURRENT_DATE)
         AND EXTRACT(MONTH FROM data_venda) = EXTRACT(MONTH FROM CURRENT_DATE)`
    );

    res.json({
      faturamentoDia: diaResult.rows[0].total,
      faturamentoMes: mesResult.rows[0].total
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar o sumário.' });
  }
});

// --- 5. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
