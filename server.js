// --- 1. IMPORTAÇÕES E CONFIGURAÇÃO INICIAL ---
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001;

// --- 2. MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- 3. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = "https://viltdxuuyerlsctfhgfb.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 4. FUNÇÕES AUXILIARES ---

// Middleware de autenticação
function autenticar(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token não fornecido" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Middleware para verificar admin
function verificarAdmin(req, res, next) {
  if (req.usuario.tipo_usuario !== "admin") {
    return res.status(403).json({ error: "Acesso negado" });
  }
  next();
}

// --- UTILITÁRIO: retorna data/hora em Brasília em ISO ---
function brasiliaISOString() {
  const date = new Date();
  const brasiliaTime = new Date(
    date.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
  return brasiliaTime.toISOString();
}

// --- 5. ROTAS DE AUTENTICAÇÃO ---

// Cadastro de usuário
app.post("/api/usuarios", async (req, res) => {
  const { nome, email, senha, tipo_usuario } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ error: "Nome, email e senha são obrigatórios" });

  const hashSenha = await bcrypt.hash(senha, 10);

  try {
    const { data, error } = await supabase
      .from("usuarios")
      .insert([{ nome, email, senha: hashSenha, tipo_usuario: tipo_usuario || "colaborador" }])
      .select();

    if (error) throw error;

    res.status(201).json({
      id: data[0].id,
      nome: data[0].nome,
      email: data[0].email,
      tipo_usuario: data[0].tipo_usuario,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao cadastrar usuário" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "Email e senha obrigatórios" });

  try {
    const { data: usuarioData, error } = await supabase
      .from("usuarios")
      .select("*")
      .eq("email", email)
      .single();

    if (error || !usuarioData) return res.status(401).json({ error: "Usuário não encontrado" });

    const senhaCorreta = await bcrypt.compare(senha, usuarioData.senha);
    if (!senhaCorreta) return res.status(401).json({ error: "Senha incorreta" });

    const token = jwt.sign(
      { id: usuarioData.id, tipo_usuario: usuarioData.tipo_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      id: usuarioData.id,
      nome: usuarioData.nome,
      tipo_usuario: usuarioData.tipo_usuario,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao logar" });
  }
});

// --- 6. ROTAS PRINCIPAIS COM AUTENTICAÇÃO ---

// Clientes
app.get("/api/clientes", autenticar, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nome");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar clientes." });
  }
});

app.post("/api/clientes", autenticar, async (req, res) => {
  const { nome, telefone } = req.body;
  if (!nome) return res.status(400).json({ error: "Nome é obrigatório" });

  try {
    // Removido 'created_at' para evitar erro
    const { data, error } = await supabase
      .from("clientes")
      .insert([{ nome, telefone }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar cliente." });
  }
});

// Tipos de serviço
app.get("/api/tipos_servicos", autenticar, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("tipos_servicos")
      .select("*")
      .order("nome");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar tipos de serviços." });
  }
});

app.post("/api/tipos_servicos", autenticar, async (req, res) => {
  const { nome, valor_padrao } = req.body;
  if (!nome || !valor_padrao) return res.status(400).json({ error: "Nome e valor são obrigatórios." });

  try {
    const dataCriacao = brasiliaISOString();
    const { data, error } = await supabase
      .from("tipos_servicos")
      .insert([{ nome, valor_padrao, created_at: dataCriacao }])
      .select();
    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao adicionar tipo de serviço." });
  }
});

// Registrar venda
app.post("/api/vendas", autenticar, async (req, res) => {
  const { cliente_id, valor_total, itens } = req.body;
  if (!cliente_id || !valor_total || !itens || itens.length === 0)
    return res.status(400).json({ error: "Dados incompletos para registrar a venda." });

  try {
    const dataVenda = brasiliaISOString(); // horário de Brasília

    const { data: vendaData, error: vendaError } = await supabase
      .from("registros_vendas")
      .insert([{ cliente_id, usuario_id: req.usuario.id, valor_total, data_venda: dataVenda }])
      .select();
    if (vendaError) throw vendaError;

    const vendaId = vendaData[0].id;

    const itensInsert = itens.map(item => ({
      venda_id: vendaId,
      servico_id: item.servico_id,
      valor_cobrado: item.valor_cobrado
    }));

    const { error: itensError } = await supabase.from("venda_itens").insert(itensInsert);
    if (itensError) throw itensError;

    res.status(201).json({ message: "Venda registrada com sucesso!", vendaId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao registrar a venda." });
  }
});

// Histórico de vendas
app.get("/api/historico", autenticar, async (req, res) => {
  try {
    let query = supabase
      .from("registros_vendas")
      .select(`
        id,
        valor_total,
        data_venda,
        usuario_id,
        usuarios!inner(nome),
        clientes!inner(nome),
        venda_itens(
          id,
          valor_cobrado,
          tipos_servicos!inner(nome)
        )
      `)
      .order("data_venda", { ascending: false });

    if (req.usuario.tipo_usuario !== "admin") query = query.eq("usuario_id", req.usuario.id);

    const { data, error } = await query;
    if (error) throw error;

    const vendasFormatadas = data.map((v) => ({
      ...v,
      usuario_nome: v.usuarios?.nome || null,
      cliente_nome: v.clientes?.nome || null,
    }));

    res.json(vendasFormatadas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar histórico." });
  }
});

// Sumário de faturamento
app.get("/api/sumario", autenticar, async (req, res) => {
  try {
    let query = supabase
      .from("registros_vendas")
      .select("valor_total, data_venda");
    if (req.usuario.tipo_usuario !== "admin") query = query.eq("usuario_id", req.usuario.id);

    const { data: vendas, error } = await query;
    if (error) throw error;

    const hojeBR = new Date(brasiliaISOString());

    const faturamentoDia = vendas
      .filter(v => new Date(v.data_venda).toDateString() === hojeBR.toDateString())
      .reduce((acc, v) => acc + Number(v.valor_total), 0);

    const faturamentoMes = vendas
      .filter(v => {
        const dataVenda = new Date(v.data_venda);
        return dataVenda.getMonth() === hojeBR.getMonth() &&
               dataVenda.getFullYear() === hojeBR.getFullYear();
      })
      .reduce((acc, v) => acc + Number(v.valor_total), 0);

    res.json({ faturamentoDia, faturamentoMes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar o sumário." });
  }
});

// Excluir venda e, se possível, o cliente
app.delete("/api/vendas/:id/excluir-cliente", autenticar, async (req, res) => {
  const { id } = req.params;

  try {
    // Busca a venda
    const { data: venda, error: vendaError } = await supabase
      .from("registros_vendas")
      .select("*")
      .eq("id", id)
      .single();

    if (vendaError || !venda) return res.status(404).json({ error: "Venda não encontrada." });

    // Permissão: não-admin só pode deletar suas próprias vendas
    if (req.usuario.tipo_usuario !== "admin" && venda.usuario_id !== req.usuario.id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const clienteId = venda.cliente_id;

    // Deleta os itens da venda
    const { error: itensError } = await supabase
      .from("venda_itens")
      .delete()
      .eq("venda_id", id);
    if (itensError) throw itensError;

    // Deleta a venda
    const { error: vendaDeleteError } = await supabase
      .from("registros_vendas")
      .delete()
      .eq("id", id);
    if (vendaDeleteError) throw vendaDeleteError;

    // Verifica se o cliente ainda tem outras vendas
    const { data: outrasVendas, error: outrasVendasError } = await supabase
      .from("registros_vendas")
      .select("*")
      .eq("cliente_id", clienteId);

    if (outrasVendasError) throw outrasVendasError;

    // Se não houver mais vendas desse cliente, apaga o cliente também
    if (!outrasVendas || outrasVendas.length === 0) {
      const { error: clienteDeleteError } = await supabase
        .from("clientes")
        .delete()
        .eq("id", clienteId);

      if (clienteDeleteError) throw clienteDeleteError;
    }

    res.json({ message: "Venda (e cliente, se sem outras vendas) excluída com sucesso." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao excluir venda/cliente." });
  }
});


// --- 7. INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
