import type { Database } from "bun:sqlite";

// tb_rfid: registros de etiqueta RFID por org+code+type.
export function run(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tb_rfid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org INTEGER NOT NULL,
      code INTEGER NOT NULL,
      type INTEGER NOT NULL,
      prefix VARCHAR(19) NOT NULL,
      extras VARCHAR(2500) NOT NULL
    );
  `);

  // contador de code e por prefix -> code nao pode repetir dentro do mesmo prefix
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_tb_rfid_prefix_code
      ON tb_rfid (org, prefix, code);
  `);
}
