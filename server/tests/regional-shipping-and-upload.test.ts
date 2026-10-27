import assert from "node:assert/strict";
import { test } from "node:test";
import { isDanangProvince } from "../src/services/commerce";
import { storeSettingsSchema } from "../src/validators/schemas";

test("isDanangProvince accurately detects Da Nang across varied accents and formatting", () => {
  assert.equal(isDanangProvince("Đà Nẵng"), true);
  assert.equal(isDanangProvince("Thành phố Đà Nẵng"), true);
  assert.equal(isDanangProvince("TP. Đà Nẵng"), true);
  assert.equal(isDanangProvince("Da Nang"), true);
  assert.equal(isDanangProvince("TP Da Nang"), true);
  assert.equal(isDanangProvince("Quận Hải Châu, TP Đà Nẵng"), true);

  assert.equal(isDanangProvince("Hà Nội"), false);
  assert.equal(isDanangProvince("TP Hồ Chí Minh"), false);
  assert.equal(isDanangProvince("Quảng Nam"), false);
  assert.equal(isDanangProvince("Thừa Thiên Huế"), false);
  assert.equal(isDanangProvince(""), false);
  assert.equal(isDanangProvince(null), false);
  assert.equal(isDanangProvince(undefined), false);
});

test("storeSettingsSchema accepts and validates shipping_fee_danang", () => {
  const base = {
    store_name: "Nước mắm Nam Ô",
    store_description: null,
    logo_url: null,
    store_address: null,
    contact_phone: null,
    contact_email: null,
    shipping_fee: 30000,
    shipping_fee_danang: 15000,
    free_shipping_enabled: false,
    free_shipping_minimum: null,
    customer_cancellation_statuses: ["PENDING"],
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

  const parsed = storeSettingsSchema.parse(base);
  assert.equal(parsed.shipping_fee_danang, 15000);
  assert.equal(parsed.shipping_fee, 30000);

  // Negative shipping fee must be rejected
  assert.equal(storeSettingsSchema.safeParse({ ...base, shipping_fee_danang: -5000 }).success, false);

  // Null is valid (falls back to shipping_fee)
  const parsedNull = storeSettingsSchema.parse({ ...base, shipping_fee_danang: null });
  assert.equal(parsedNull.shipping_fee_danang, null);
});
