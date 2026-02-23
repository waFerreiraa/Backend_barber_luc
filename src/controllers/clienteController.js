import { supabase } from "../config/supabase.js";

export async function listarClientes(req, res) {
  try {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", req.usuario.empresa_id) // 🔐 isolamento
      .order("nome");

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar clientes." });
  }
}

// src/controllers/clienteController.js
export async function criarCliente(req, res) {
  const { nome, telefone } = req.body;

  if (!nome) {
    return res.status(400).json({ error: "Nome é obrigatório" });
  }

  try {
    const { data, error } = await supabase
      .from("clientes")
      .insert([
        {
          nome,
          telefone,
          empresa_id: req.usuario.empresa_id,
        },
      ])
      .select();

    if (error) throw error;

    return res.status(201).json(data[0]);
  } catch (error) {
    console.error("criarCliente error:", error); // ✅ MOSTRA NO TERMINAL
    return res.status(500).json({
      error: error?.message || "Erro ao adicionar cliente.",
      details: error?.details || null,
      code: error?.code || null,
    });
  }
}
