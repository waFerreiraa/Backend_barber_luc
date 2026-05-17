import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import routes from "./src/routes/index.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ suas rotas já têm /api/... dentro de cada arquivo
app.use('/api',routes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

console.log("ROTAS CARREGADAS:", routes?.stack?.length);