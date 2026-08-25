import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTodayOrder, upsertTodayOrder } from "../api/retailer";
import { apiItems } from "../api/items";
import type { OrderItemCreate } from "../types/api";

export function useRetailerCart(onSuccess: () => void) {
  const [cart, setCart] = useState<Record<string, OrderItemCreate>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["retailer_items"],
    queryFn: () => apiItems.list(true),
  });
  const items = itemsPage?.items || [];

  const loadExisting = useCallback(async () => {
    try {
      const order = await getTodayOrder();
      if (order && order.items) {
        const existingCart: Record<string, OrderItemCreate> = {};
        for (const it of order.items) {
          existingCart[it.item_id] = {
            item_id: it.item_id,
            requested_kg: String(it.requested_kg || "0"),
            bird_size: it.bird_size,
            notes: it.notes || "",
          };
        }
        setCart(existingCart);
      }
    } catch {
      // ignore preload errors
    }
  }, []);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const updateCartItem = (itemId: string, field: keyof OrderItemCreate, value: string | null) => {
    setCart((prev) => {
      const existing = prev[itemId] || { item_id: itemId, requested_kg: "0", bird_size: "Medium", notes: "" };
      return {
        ...prev,
        [itemId]: { ...existing, [field]: value },
      };
    });
  };

  const adjustKg = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId] || { item_id: itemId, requested_kg: "0", bird_size: "Medium", notes: "" };
      const current = Number(existing.requested_kg || "0");
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, requested_kg: String(next) },
      };
    });
  };

  async function onSubmit() {
    const payloadItems = Object.values(cart).filter((it) => Number(it.requested_kg) > 0);
    if (payloadItems.length === 0) {
      setMessage("Add at least one item to your order");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await upsertTodayOrder({ items: payloadItems });
      onSuccess();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save order");
    } finally {
      setBusy(false);
    }
  }

  const totalKg = Object.values(cart).reduce((sum, it) => sum + Number(it.requested_kg || 0), 0);

  return {
    cart,
    busy,
    message,
    items,
    loadingItems,
    totalKg,
    updateCartItem,
    adjustKg,
    onSubmit,
  };
}
