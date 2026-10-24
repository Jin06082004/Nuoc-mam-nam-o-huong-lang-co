import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/utils/errors";
import { calculateDiscount, calculateOrderTotals } from "../src/services/money";

test("order totals add rounded line amounts without floating-point currency drift", () => {
  assert.deepEqual(calculateOrderTotals([0.1, 0.2, 10.005], 5, 1.01), {
    subtotal: 10.31,
    shippingFee: 5,
    discount: 1.01,
    total: 14.3,
  });
});

test("discount calculation respects percentage and maximum discount", () => {
  assert.equal(calculateDiscount(100, "PERCENTAGE", 15, 10), 10);
  assert.equal(calculateDiscount(100, "FIXED_AMOUNT", 250, null), 100);
});

test("negative or non-finite amounts are rejected", () => {
  assert.throws(() => calculateOrderTotals([-1], 0, 0), AppError);
  assert.throws(() => calculateOrderTotals([Number.NaN], 0, 0), AppError);
});

test("discount cannot exceed subtotal plus shipping", () => {
  assert.throws(() => calculateOrderTotals([10], 2, 13), AppError);
});
