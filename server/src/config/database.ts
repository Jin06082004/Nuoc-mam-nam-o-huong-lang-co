import fs from "node:fs";
import path from "node:path";
import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { env } from "./env";
import { seedVerifiedData } from "../scripts/seed-verified-data";

export type SqlValue = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;
export const pool = mysql.createPool({
  host: env.DATABASE_HOST,
  port: env.DATABASE_PORT,
  database: env.DATABASE_NAME,
  user: env.DATABASE_USER,
  password: env.DATABASE_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  decimalNumbers: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: true,
});

export async function rows<T extends RowDataPacket>(
  sql: string,
  values: readonly SqlValue[] = [],
): Promise<T[]> {
  const [result] = await pool.execute<T[]>(sql, [...values]);
  return result;
}

export async function execute(
  sql: string,
  values: readonly SqlValue[] = [],
): Promise<ResultSetHeader> {
  const [result] = await pool.execute<ResultSetHeader>(sql, [...values]);
  return result;
}

export async function checkDatabase(): Promise<void> {
  await pool.query("SELECT 1");
  try {
    const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'products'");
    if (tables.length === 0) {
      console.info("Schema not detected in target database; applying initial schema...");
      const schemaPaths = [
        path.resolve(process.cwd(), "schema.sql"),
        path.resolve(__dirname, "../../schema.sql"),
        path.resolve(__dirname, "../../../database/schema.sql"),
      ];
      let sql = "";
      for (const p of schemaPaths) {
        if (fs.existsSync(p)) {
          sql = fs.readFileSync(p, "utf8");
          break;
        }
      }
      if (sql) {
        const sanitized = sql
          .replace(/CREATE DATABASE[\s\S]*?;/gi, "")
          .replace(/USE [\s\S]*?;/gi, "");
        await pool.query(sanitized);
        console.info("Database schema applied successfully.");
      }
    }

    try {
      const [prodRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM products");
      const total = Number((prodRows[0] as { total?: number })?.total || 0);
      if (total === 0) {
        console.info("Products table is empty. Running seedVerifiedData...");
        await seedVerifiedData(pool);
      }
    } catch (seedErr) {
      console.warn("Seed verified data check warning:", seedErr);
    }
  } catch (err) {
    console.warn("Schema initialization check warning:", err);
  }
}
