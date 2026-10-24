import { AppError } from "../utils/errors";

export interface OrderTotals {
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

export function calculateOrderTotals(
  itemAmounts: readonly number[],
  shippingFee: number,
  discount: number,
): OrderTotals {
  const cents = (amount: number): number => {
    if (!Number.isFinite(amount) || amount < 0) throw new AppError("Amounts must be finite and nonnegative", 422);
    return Math.round(amount * 100);
  };
  const subtotalCents = itemAmounts.reduce((sum, amount) => sum + cents(amount), 0);
  const shippingCents = cents(shippingFee);
  const discountCents = cents(discount);
  if (discountCents > subtotalCents + shippingCents) {
    throw new AppError("Discount cannot exceed the order amount", 422);
  }
  return {
    subtotal: subtotalCents / 100,
    shippingFee: shippingCents / 100,
    discount: discountCents / 100,
    total: (subtotalCents + shippingCents - discountCents) / 100,
  };
}

export function calculateDiscount(
  subtotal: number,
  type: "PERCENTAGE" | "FIXED_AMOUNT",
  value: number,
  maxDiscount: number | null,
): number {
  const raw = type === "PERCENTAGE" ? subtotal * value / 100 : value;
  const bounded = maxDiscount === null ? raw : Math.min(raw, maxDiscount);
  return Math.round(Math.min(subtotal, bounded) * 100) / 100;
}
