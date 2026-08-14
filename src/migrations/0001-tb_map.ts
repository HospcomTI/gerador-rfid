import type { Database } from "bun:sqlite";

// tb_map: id serial, type varchar(10), name varchar(500), uk (type + name)
export function run(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS tb_map (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org INTEGER NOT NULL,
      code INTEGER NOT NULL,
      type VARCHAR(10) NOT NULL,
      name VARCHAR(500) NOT NULL,
      UNIQUE (org, type, code),
      UNIQUE (org, type, name)
    );
  `);
}
