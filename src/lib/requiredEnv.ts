export function requiredEnv(name: string): string {
  const v = Bun.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Variavel de ambiente ausente: ${name}`);
  }
  return v.trim();
}