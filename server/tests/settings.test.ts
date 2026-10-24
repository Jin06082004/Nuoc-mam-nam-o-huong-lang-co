import assert from "node:assert/strict";
import { test } from "node:test";
import { storeSettingsSchema } from "../src/validators/schemas";

const validSettings = {
  store_name: "Nước mắm Nam Ô Hương Làng Cổ",
  store_description: null,
  logo_url: null,
  store_address: null,
  contact_phone: null,
  contact_email: null,
  shipping_fee: 25000,
  free_shipping_enabled: false,
  free_shipping_minimum: null,
  customer_cancellation_statuses: ["PENDING", "CONFIRMED"],
  cod_enabled: true,
  bank_transfer_enabled: false,
  bank_name: null,
  bank_account_number: null,
  bank_account_holder: null,
  bank_branch: null,
  facebook_url: null,
  tiktok_url: null,
  youtube_url: null,
};

test("settings accept intentionally unconfigured contact, bank, and social values", () => {
  const result = storeSettingsSchema.parse(validSettings);
  assert.equal(result.contact_phone, null);
  assert.equal(result.bank_account_number, null);
  assert.equal(result.facebook_url, null);
  assert.equal(result.tiktok_url, null);
  assert.equal(result.youtube_url, null);
});

test("settings reject non-HTTP URLs, invalid money, and unknown secret fields", () => {
  assert.equal(storeSettingsSchema.safeParse({ ...validSettings, facebook_url: "javascript:alert(1)" }).success, false);
  assert.equal(storeSettingsSchema.safeParse({ ...validSettings, shipping_fee: -1 }).success, false);
  assert.equal(storeSettingsSchema.safeParse({ ...validSettings, bank_password: "must not persist" }).success, false);
});

test("enabling bank transfer requires public account display details", () => {
  assert.equal(storeSettingsSchema.safeParse({ ...validSettings, bank_transfer_enabled: true }).success, false);
  assert.equal(storeSettingsSchema.safeParse({
    ...validSettings,
    bank_transfer_enabled: true,
    bank_name: "Ngân hàng",
    bank_account_number: "000123456789",
    bank_account_holder: "CHU TAI KHOAN",
  }).success, true);
});

test("free shipping requires a minimum order amount and cancellation statuses cannot be duplicated", () => {
  assert.equal(storeSettingsSchema.safeParse({ ...validSettings, free_shipping_enabled: true }).success, false);
  assert.equal(storeSettingsSchema.safeParse({
    ...validSettings,
    free_shipping_enabled: true,
    free_shipping_minimum: 0,
  }).success, true);
  assert.equal(storeSettingsSchema.safeParse({
    ...validSettings,
    customer_cancellation_statuses: ["PENDING", "PENDING"],
  }).success, false);
});
