import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";
import type { z } from "zod";
import { execute, rows, type SqlValue } from "../config/database";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import type { storeSettingsSchema } from "../validators/schemas";

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
export type CancellationStatus = "PENDING" | "CONFIRMED";

export interface StoreSettings {
  store_name: string;
  store_description: string | null;
  logo_url: string | null;
  store_address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  shipping_fee: number | null;
  free_shipping_enabled: boolean;
  free_shipping_minimum: number | null;
  customer_cancellation_statuses: CancellationStatus[];
  cod_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  bank_branch: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
}

interface StoreSettingsRow extends RowDataPacket, Omit<StoreSettings, "customer_cancellation_statuses"> {
  customer_cancellation_statuses: string | CancellationStatus[];
}

const settingsSelect = `SELECT store_name, store_description, logo_url, store_address, contact_phone, contact_email,
  shipping_fee, free_shipping_enabled, free_shipping_minimum, customer_cancellation_statuses, cod_enabled,
  bank_transfer_enabled, bank_name, bank_account_number, bank_account_holder, bank_branch,
  facebook_url, tiktok_url, youtube_url
  FROM store_settings WHERE id=1 LIMIT 1`;

function cancellationStatuses(value: StoreSettingsRow["customer_cancellation_statuses"]): CancellationStatus[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((status) => status !== "PENDING" && status !== "CONFIRMED")) {
    throw new AppError("Store cancellation settings are invalid", 500);
  }
  return parsed;
}

function numericOrNull(value: string | number | null): number | null {
  return value === null ? null : Number(value);
}

function mapSettings(row: StoreSettingsRow): StoreSettings {
  return {
    store_name: row.store_name,
    store_description: row.store_description,
    logo_url: row.logo_url,
    store_address: row.store_address,
    contact_phone: row.contact_phone,
    contact_email: row.contact_email,
    shipping_fee: numericOrNull(row.shipping_fee) ?? env.SHIPPING_FEE ?? null,
    free_shipping_enabled: Boolean(row.free_shipping_enabled),
    free_shipping_minimum: numericOrNull(row.free_shipping_minimum),
    customer_cancellation_statuses: cancellationStatuses(row.customer_cancellation_statuses),
    cod_enabled: Boolean(row.cod_enabled),
    bank_transfer_enabled: Boolean(row.bank_transfer_enabled),
    bank_name: row.bank_name,
    bank_account_number: row.bank_account_number,
    bank_account_holder: row.bank_account_holder,
    bank_branch: row.bank_branch,
    facebook_url: row.facebook_url,
    tiktok_url: row.tiktok_url,
    youtube_url: row.youtube_url,
  };
}

export async function readStoreSettings(connection?: PoolConnection): Promise<StoreSettings> {
  const result = connection
    ? (await connection.execute<StoreSettingsRow[]>(settingsSelect))[0]
    : await rows<StoreSettingsRow>(settingsSelect);
  const setting = result[0];
  if (!setting) throw new AppError("Store settings are not initialized; apply the store settings migration", 503);
  return mapSettings(setting);
}

export async function readPublicStoreSettings(): Promise<Omit<StoreSettings, "customer_cancellation_statuses">> {
  const { customer_cancellation_statuses: _privateSetting, ...settings } = await readStoreSettings();
  if (settings.bank_transfer_enabled) return settings;
  return {
    ...settings,
    bank_name: null,
    bank_account_number: null,
    bank_account_holder: null,
    bank_branch: null,
  };
}

export async function updateStoreSettings(input: StoreSettingsInput): Promise<void> {
  const fields: Array<keyof StoreSettingsInput> = [
    "store_name", "store_description", "logo_url", "store_address", "contact_phone", "contact_email",
    "shipping_fee", "free_shipping_enabled", "free_shipping_minimum", "customer_cancellation_statuses",
    "cod_enabled", "bank_transfer_enabled", "bank_name", "bank_account_number", "bank_account_holder",
    "bank_branch", "facebook_url", "tiktok_url", "youtube_url",
  ];
  const values: SqlValue[] = fields.map((field) => field === "customer_cancellation_statuses"
    ? JSON.stringify(input.customer_cancellation_statuses)
    : input[field] as SqlValue);
  const columns = fields.join(", ");
  const placeholders = fields.map(() => "?").join(", ");
  const updates = fields.map((field) => `${field}=VALUES(${field})`).join(", ");
  await execute(
    `INSERT INTO store_settings (id, ${columns}) VALUES (1, ${placeholders})
     ON DUPLICATE KEY UPDATE ${updates}`,
    values,
  );
}
