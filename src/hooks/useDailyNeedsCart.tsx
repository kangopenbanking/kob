import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";
import { toast } from "sonner";

export interface CartItem {
  product_id: string;
  name: string;
  price_xaf: number;
  quantity: number;
  image_url?: string | null;
  requires_prescription?: boolean;
}

export interface CartState {
  store_id: string | null;
  store_name: string | null;
  store_vertical: "food" | "pharmacy" | null;
  items: CartItem[];
}

interface CartContextValue extends CartState {
  addItem: (
    args: { store_id: string; store_name: string; store_vertical: "food" | "pharmacy" },
    item: CartItem,
  ) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  total: number;
  itemCount: number;
  requiresPrescription: boolean;
}

const STORAGE_KEY = "kang.daily-needs.cart.v1";
const EMPTY: CartState = { store_id: null, store_name: null, store_vertical: null, items: [] };

const CartContext = createContext<CartContextValue | null>(null);

function readPersisted(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    return { ...EMPTY, ...parsed, items: Array.isArray(parsed.items) ? parsed.items : [] };
  } catch {
    return EMPTY;
  }
}

export function DailyNeedsCartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(() => readPersisted());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  const addItem: CartContextValue["addItem"] = useCallback((store, item) => {
    setState((s) => {
      // Different store: confirm replacement
      if (s.store_id && s.store_id !== store.store_id) {
        const ok = typeof window !== "undefined"
          ? window.confirm(`Your cart contains items from ${s.store_name}. Start a new cart from ${store.store_name}?`)
          : true;
        if (!ok) return s;
        toast.info("Cart cleared — starting a new order");
        return {
          store_id: store.store_id,
          store_name: store.store_name,
          store_vertical: store.store_vertical,
          items: [{ ...item, quantity: Math.max(1, item.quantity) }],
        };
      }
      const existing = s.items.find((i) => i.product_id === item.product_id);
      const items = existing
        ? s.items.map((i) => i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i)
        : [...s.items, { ...item, quantity: Math.max(1, item.quantity) }];
      return {
        store_id: store.store_id,
        store_name: store.store_name,
        store_vertical: store.store_vertical,
        items,
      };
    });
  }, []);

  const updateQuantity = useCallback((product_id: string, quantity: number) => {
    setState((s) => {
      if (quantity <= 0) {
        const items = s.items.filter((i) => i.product_id !== product_id);
        return items.length === 0 ? EMPTY : { ...s, items };
      }
      return { ...s, items: s.items.map((i) => i.product_id === product_id ? { ...i, quantity } : i) };
    });
  }, []);

  const removeItem = useCallback((product_id: string) => {
    setState((s) => {
      const items = s.items.filter((i) => i.product_id !== product_id);
      return items.length === 0 ? EMPTY : { ...s, items };
    });
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo<CartContextValue>(() => {
    const subtotal = state.items.reduce((acc, i) => acc + i.price_xaf * i.quantity, 0);
    const itemCount = state.items.reduce((acc, i) => acc + i.quantity, 0);
    const deliveryFee = state.items.length > 0 ? 500 : 0;
    const serviceFee = Math.round(subtotal * 0.02);
    const total = subtotal + deliveryFee + serviceFee;
    const requiresPrescription = state.items.some((i) => i.requires_prescription);
    return {
      ...state,
      addItem, updateQuantity, removeItem, clear,
      subtotal, deliveryFee, serviceFee, total, itemCount, requiresPrescription,
    };
  }, [state, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useDailyNeedsCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useDailyNeedsCart must be used inside DailyNeedsCartProvider");
  return ctx;
}

export function formatXAF(n: number): string {
  return `${Math.round(n).toLocaleString()} XAF`;
}
