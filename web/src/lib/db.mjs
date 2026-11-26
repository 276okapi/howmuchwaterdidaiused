// One MySQL/MariaDB connection pool per process (survives Next.js dev hot reloads).
import { createPool } from "mysql2/promise";

/** @returns {import("mysql2/promise").Pool} */
export function getPool() {
  const g = /** @type {any} */ (globalThis);
  if (!g.__cwPool) {
    if (!process.env.DATABASE_URL) {
      throw new Error("Brak DATABASE_URL w .env (np. mysql://user:haslo@localhost:3306/baza)");
    }
    g.__cwPool = createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: Number(process.env.DB_POOL_SIZE || 5),
      // timestamps are stored and read as UTC
      timezone: "Z",
      dateStrings: false,
    });
  }
  return g.__cwPool;
}
