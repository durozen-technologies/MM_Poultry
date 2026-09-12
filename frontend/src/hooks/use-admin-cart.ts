import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { createOrderAsAdmin, confirmOrder } from "../api/orders";
import { getApiErrorMessage } from "../api/client";
import { apiItems } from "../api/items";
import type { OrderItemCreate } from "../types/api";
import { todayIstDate, toApiDate } from "../utils/ist-date";

export function useAdminCart(retailerId: string | null, onSuccess: () => void) {
  const [cart, setCart] = useState<Record<string, OrderItemCreate>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState<Date | null>(todayIstDate());

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["retailer_items", { activeOnly: true }],
    queryFn: () => apiItems.list(true),
  });
  const items = itemsPage?.items || [];

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
    if (!retailerId) {
      setMessage("Please select a retailer first");
      return;
    }
    const payloadItems = Object.values(cart)
      .filter((it) => (it.total_boxes || 0) > 0)
      .map(it => ({
        ...it,
        requested_kg: it.requested_kg ? it.requested_kg : undefined,
        notes: it.notes ? it.notes : undefined,
      }));
    if (payloadItems.length === 0) {
      setMessage("Add at least one box to your order");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const order = await createOrderAsAdmin(retailerId, { 
        items: payloadItems,
        notes: orderNotes.trim() || undefined
      });
      
      const apiDate = expectedDeliveryDate ? toApiDate(expectedDeliveryDate) : toApiDate(todayIstDate());
      if (apiDate) {
        await confirmOrder(order.id, { expected_delivery_date: apiDate });
      }
      onSuccess();
    } catch (e) {
      let code = null;
      if (typeof e === "object" && e && "response" in e) {
        const resp = (e as any).response;
        if (resp?.data?.error?.code) code = resp.data.error.code;
        else if (resp?.status === 409) code = "CONFLICT";
      }
      const detail = getApiErrorMessage(e);
      if (code === "CONFLICT") {
        Alert.alert(
          "Order Already Completed",
          detail || "Today's order has already been processed for this retailer.",
          [{ text: "OK", onPress: onSuccess }],
        );
      } else {
        setMessage(detail);
      }
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
    orderNotes,
    setOrderNotes,
    expectedDeliveryDate,
    setExpectedDeliveryDate,
    updateCartItem,
    adjustBoxes,
    onSubmit,
  };
}
