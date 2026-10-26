import type { Cart, CartItem } from "./types";

const GUEST_CART_KEY = "nam_o_guest_cart";

export function getGuestCart(): Cart {
  if (typeof window === "undefined") {
    return { id: 0, status: "ACTIVE", items: [] };
  }
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return { id: 0, status: "ACTIVE", items: [] };
    const items: CartItem[] = JSON.parse(raw);
    return { id: 0, status: "ACTIVE", items };
  } catch {
    return { id: 0, status: "ACTIVE", items: [] };
  }
}

export function saveGuestCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {}
}

export function clearGuestCart(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {}
}

export function addGuestCartItem(item: Omit<CartItem, "id" | "line_total">): CartItem[] {
  const current = getGuestCart();
  const existingIndex = current.items.findIndex((i) => i.variant_id === item.variant_id);
  let updated: CartItem[];
  if (existingIndex >= 0) {
    updated = current.items.map((it, idx) => {
      if (idx !== existingIndex) return it;
      const newQty = Math.min(it.quantity + item.quantity, it.available_quantity || 999);
      return {
        ...it,
        quantity: newQty,
        line_total: Number(it.price) * newQty,
      };
    });
  } else {
    const newQty = item.quantity;
    const newItem: CartItem = {
      ...item,
      id: Date.now(),
      quantity: newQty,
      line_total: Number(item.price) * newQty,
    };
    updated = [...current.items, newItem];
  }
  saveGuestCart(updated);
  return updated;
}

export function updateGuestCartItem(id: number, quantity: number): CartItem[] {
  const current = getGuestCart();
  const updated = current.items.map((it) => {
    if (it.id !== id) return it;
    const newQty = Math.max(1, Math.min(quantity, it.available_quantity || 999));
    return {
      ...it,
      quantity: newQty,
      line_total: Number(it.price) * newQty,
    };
  });
  saveGuestCart(updated);
  return updated;
}

export function removeGuestCartItem(id: number): CartItem[] {
  const current = getGuestCart();
  const updated = current.items.filter((it) => it.id !== id);
  saveGuestCart(updated);
  return updated;
}
