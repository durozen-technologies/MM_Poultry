import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getRetailerOrder, upsertTodayOrder } from "../api/retailer";
import { getApiErrorMessage } from "../api/client";
import { apiItems } from "../api/items";
import type { OrderItemCreate } from "../types/api";

export function useRetailerCart(onSuccess: () => void, orderId?: string) {
  const [cart, setCart] = useState<Record<string, OrderItemCreate>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["retailer_items", { activeOnly: true }],
    queryFn: () => apiItems.list(true),
  });
  const items = itemsPage?.items || [];

  const loadExisting = useCallback(async () => {
    if (!orderId) return;
    try {
      const order = await getRetailerOrder(orderId);
      if (order && order.items) {
        const existingCart: Record<string, OrderItemCreate> = {};
        for (const it of order.items) {
          existingCart[it.item_id] = {
            item_id: it.item_id,
            total_boxes: it.total_boxes || 0,
            requested_kg: it.requested_kg || "",
            bird_size: it.bird_size,
            notes: it.notes || "",
          };
        }
        setCart(existingCart);
      }
    } catch {
      // ignore preload errors
    }
  }, [orderId]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting, orderId]);

  const updateCartItem = (itemId: string, field: keyof OrderItemCreate, value: unknown) => {
    setCart((prev) => {
      const existing = prev[itemId] || { item_id: itemId, total_boxes: 0, requested_kg: "", notes: "" };

      let sanitized: unknown = value;
      if (field === "total_boxes") {
        const n = Number(value);
        sanitized = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
      }
      if (field === "requested_kg") {
        const s = String(value ?? "");
        const n = Number(s);
        sanitized = s === "" ? "" : (Number.isFinite(n) ? String(n) : "");
      }
      if (field === "notes") {
        sanitized = String(value ?? "").slice(0, 500);
      }
      return {
        ...prev,
        [itemId]: { ...existing, [field]: sanitized } as OrderItemCreate,
      };
    });
  };

  const adjustBoxes = (itemId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev[itemId] || { item_id: itemId, total_boxes: 0, requested_kg: "", notes: "" };

      const current = existing.total_boxes || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, total_boxes: next },
      };
    });
  };

  async function onSubmit() {
    const payloadItems = Object.values(cart)
      .filter((it) => (it.total_boxes || 0) > 0)
      .map(it => ({
        ...it,
        requested_kg: it.requested_kg ? it.requested_kg : undefined,
        bird_size: it.bird_size ? it.bird_size : undefined,
        notes: it.notes ? it.notes : undefined,
      }));
    if (payloadItems.length === 0) {
      setMessage("Add at least one box to your order");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await upsertTodayOrder({ order_id: orderId, items: payloadItems });
      onSuccess();
    } catch (e) {
      setMessage(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const totalBoxes = Object.values(cart).reduce((sum, it) => {
    const v = it.total_boxes || 0;
    return sum + (Number.isFinite(v) ? v : 0);
  }, 0);
  const totalKg = Object.values(cart).reduce((sum, it) => {
    const n = Number(it.requested_kg || 0);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  return {
    cart,
    busy,
    message,
    items,
    loadingItems,
    totalBoxes,
    totalKg,
    updateCartItem,
    adjustBoxes,
    onSubmit,
  };
}
