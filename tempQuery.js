import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://ewavsrlfbgrzmhmuhoge.supabase.co", process.env.SUPABASE_KEY);
(async () => {
  const { data, error } = await supabase
    .from("empresas")
    .select("id, nome, empresa_configuracoes ( id, nome_exibicao, logo_url, cor_primaria, cor_secundaria )")
    .order("nome", { ascending: true });
  console.log("error:", error);
  console.log("data:", data ? data.slice(0,3) : null);
})();
