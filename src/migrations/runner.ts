import { Glob } from "bun";
import type { Database } from "bun:sqlite";

// Executa migrations pendentes.
// Cada migration e um arquivo NNNN-nome.ts que exporta `run(db)`.
// Controle das ja executadas fica na tabela _migrations, pelo nome do arquivo.
export async function runMigrations(db: Database): Promise<void> {
  // tabela de controle
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const executadas = new Set(
    db
      .query<{ name: string }, []>("SELECT name FROM _migrations")
      .all()
      .map((r) => r.name),
  );

  // arquivos de migration nesta pasta, ordenados pelo prefixo numerico
  // import.meta.dir = path do SO correto (no Windows .pathname vira "/C:/..." e quebra)
  const glob = new Glob("[0-9]*-*.ts");
  const arquivos = (
    await Array.fromAsync(glob.scan({ cwd: import.meta.dir }))
  ).sort();

  for (const arquivo of arquivos) {
    if (executadas.has(arquivo)) continue;

    // resolve o arquivo relativo a este modulo (cross-platform, gera file:// URL)
    const mod = await import(new URL(arquivo, import.meta.url).href);
    if (typeof mod.run !== "function") {
      throw new Error(`Migration sem export run: ${arquivo}`);
    }

    // migration + registro no mesmo transaction
    const tx = db.transaction(() => {
      mod.run(db);
      db.run("INSERT INTO _migrations (name) VALUES (?)", [arquivo]);
    });
    tx();

    console.log("migration executada:", arquivo);
  }
}
