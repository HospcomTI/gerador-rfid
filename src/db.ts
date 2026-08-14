import { Database } from "bun:sqlite";
import { config } from "./config";

// conexao unica com o SQLite (config.sqlitePath)
export const db = new Database(config.sqlitePath, { create: true });
