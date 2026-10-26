import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

async function updateBank() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT || 3306),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    charset: "utf8mb4",
  });

  try {
    await connection.execute(`
      UPDATE store_settings SET
        bank_transfer_enabled = 1,
        bank_name = 'ACMEBank',
        bank_account_number = '3897126450',
        bank_account_holder = 'NGUYEN NGUYEN PHUC',
        bank_branch = 'SePay Sandbox (TK ảo: SBPAY9735061428)',
        updated_at = NOW()
      WHERE id = 1
    `);

    const [rows] = await connection.query(
      "SELECT bank_transfer_enabled, bank_name, bank_account_number, bank_account_holder, bank_branch FROM store_settings WHERE id = 1"
    );
    console.info("Updated store settings:", rows);
  } finally {
    await connection.end();
  }
}

updateBank().catch((err) => {
  console.error("Failed to update bank settings:", err);
  process.exit(1);
});
