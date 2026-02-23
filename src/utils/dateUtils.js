export function brasiliaISOString() {
  const now = new Date();

  // converte corretamente usando timezone real
  const brasilia = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  // vira formato ISO aceito pelo postgres
  return brasilia.replace(" ", "T");
}