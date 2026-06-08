import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";
const token = jwt.sign({ id: 1, empresa_id: 1, tipo_usuario: "dono" }, process.env.JWT_SECRET, { expiresIn: "1h" });
const url = "http://localhost:10000/api/admin/empresas-config";
(async () => {
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await response.text();
    console.log("status", response.status);
    console.log("body", text);
  } catch (err) {
    console.error(err);
  }
})();
