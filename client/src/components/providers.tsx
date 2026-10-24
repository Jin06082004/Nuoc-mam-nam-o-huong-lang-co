"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import type { Cart, StoreSettings, User } from "@/lib/types";

interface StoreContextValue {
  user: User | null;
  cart: Cart | null;
  storeSettings: StoreSettings | null;
  storeSettingsLoading: boolean;
  storeSettingsError: string;
  cartCount: number;
  authLoading: boolean;
  cartLoading: boolean;
  refreshUser: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshStoreSettings: () => Promise<void>;
  setUser: (user: User | null) => void;
  notify: (message: string, kind?: "success" | "error") => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);
  const [storeSettingsLoading, setStoreSettingsLoading] = useState(true);
  const [storeSettingsError, setStoreSettingsError] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; kind: "success" | "error"; id: number } | null>(null);

  const notify = useCallback((message: string, kind: "success" | "error" = "success") => {
    setNotice({ message, kind, id: Date.now() });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const result = await api.me();
      setUser(result.user);
    } catch (error) {
      setUser(null);
      if (error instanceof ApiError && error.status !== 401 && error.status !== 0) {
        notify(error.message, "error");
      }
    } finally {
      setAuthLoading(false);
    }
  }, [notify]);

  const refreshCart = useCallback(async () => {
    if (!user) {
      setCart(null);
      setCartLoading(false);
      return;
    }
    setCartLoading(true);
    try {
      setCart(await api.cart());
    } catch (error) {
      setCart(null);
      if (error instanceof ApiError && error.status !== 401) notify(error.message, "error");
    } finally {
      setCartLoading(false);
    }
  }, [notify, user]);

  const refreshStoreSettings = useCallback(async () => {
    setStoreSettingsLoading(true);
    setStoreSettingsError("");
    try {
      setStoreSettings(await api.storeSettings());
    } catch (error) {
      setStoreSettings(null);
      setStoreSettingsError(error instanceof ApiError ? error.message : "Không thể tải cài đặt cửa hàng.");
    } finally {
      setStoreSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    void refreshStoreSettings();
  }, [refreshStoreSettings]);

  useEffect(() => {
    void refreshCart();
  }, [refreshCart]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const value = useMemo(() => ({
    user, cart, storeSettings, storeSettingsLoading, storeSettingsError, cartCount, authLoading, cartLoading,
    refreshUser, refreshCart, refreshStoreSettings, setUser, notify,
  }), [user, cart, storeSettings, storeSettingsLoading, storeSettingsError, cartCount, authLoading, cartLoading,
    refreshUser, refreshCart, refreshStoreSettings, notify]);

  return (
    <StoreContext.Provider value={value}>
      {children}
      {notice && (
        <div className={`toast toast--${notice.kind}`} role="status" aria-live="polite" key={notice.id}>
          <span aria-hidden="true">{notice.kind === "success" ? "✓" : "!"}</span>
          {notice.message}
          <button type="button" className="toast__close" onClick={() => setNotice(null)} aria-label="Đóng thông báo">×</button>
        </div>
      )}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
