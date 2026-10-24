import mysql, { type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { env } from "./env";

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
}
