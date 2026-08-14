// Config carregada do .env (Bun auto-load, sem dotenv).

function required(name: string): string {
  const v = Bun.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Variavel de ambiente ausente: ${name}`);
  }
  return v.trim();
}

function bool(name: string, fallback = false): boolean {
  const v = Bun.env[name];
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "sim"].includes(v.trim().toLowerCase());
}

export const config = {
  orgName: required("ORG_NAME"),
  xlsxPath: required("XLSX_IN_PATH"),
  xlsxOutPath: required("XLSX_OUT_PATH"),
  sheet1: required("XLSX_SHEET_1"),
  sheet2: required("XLSX_SHEET_2"),
  sqlitePath: required("SQLITE_PATH"),
  impressoraTipo: required("IMPRESSORA_TIPO"),
  impressoraIp: required("IMPRESSORA_IP"),
} as const;
