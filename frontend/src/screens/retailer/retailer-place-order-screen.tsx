import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getTodayOrder, upsertTodayOrder } from "../../api/retailer";
import { apiItems } from "../../api/items";
import type { OrderItemCreate } from "../../types/api";

const BIRD_SIZES = ["Small", "Medium", "Large", "XL"];

export function RetailerPlaceOrderScreen({ navigation }: { navigation: any }) {
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
    const payloadItems = Object.values(cart).filter(it => Number(it.requested_kg) > 0);
    if (payloadItems.length === 0) {
      setMessage("Add at least one item to your order");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await upsertTodayOrder({ items: payloadItems });
      navigation.goBack();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save order");
    } finally {
      setBusy(false);
    }
  }

  const totalKg = Object.values(cart).reduce((sum, it) => sum + Number(it.requested_kg || 0), 0);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Place Order</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {message ? (
          <View className="bg-error-container rounded-lg px-3 py-2 mb-3">
            <Text className="text-error text-center">{message}</Text>
          </View>
        ) : null}

        {loadingItems ? (
          <ActivityIndicator color="#012d1d" size="large" className="mt-8" />
        ) : items.length === 0 ? (
          <Text className="text-center text-on-surface-variant mt-8">No items available to order.</Text>
        ) : (
          items.map((item) => {
            const cartItem = cart[item.id];
            const qty = cartItem ? cartItem.requested_kg : "0";
            const isSelected = Number(qty) > 0;

            return (
              <View key={item.id} className={`bg-surface-container-lowest rounded-2xl p-4 border mb-4 ${isSelected ? "border-primary" : "border-outline-variant/20"}`}>
                <Text className="font-headline-sm text-on-surface mb-1">{item.name}</Text>
                {item.description ? <Text className="font-body-sm text-on-surface-variant mb-3">{item.description}</Text> : <View className="mb-2" />}

                <Text className="font-label-md text-on-surface-variant mb-2">Quantity (kg)</Text>
                <View className="flex-row items-center justify-between mb-4">
                  <Pressable accessibilityRole="button"
                    className="w-12 h-12 rounded-full bg-surface-variant items-center justify-center"
                    onPress={() => adjustKg(item.id, -5)}
                  >
                    <MaterialIcons name="remove" size={24} className="text-on-surface" />
                  </Pressable>
                  <TextInput
                    className="flex-1 mx-3 text-center font-display-md text-on-surface border border-outline-variant rounded-xl py-3"
                    value={qty}
                    onChangeText={(v) => updateCartItem(item.id, "requested_kg", v)}
                    keyboardType="decimal-pad"
                  />
                  <Pressable accessibilityRole="button"
                    className="w-12 h-12 rounded-full bg-surface-variant items-center justify-center"
                    onPress={() => adjustKg(item.id, 5)}
                  >
                    <MaterialIcons name="add" size={24} className="text-on-surface" />
                  </Pressable>
                </View>

                {isSelected && (
                  <>
                    <Text className="font-label-md text-on-surface-variant mb-3">Bird size</Text>
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {BIRD_SIZES.map((size) => {
                        const active = cartItem?.bird_size === size;
                        return (
                          <Pressable accessibilityRole="button"
                            key={size}
                            className={`px-4 py-2 rounded-full border ${
                              active ? "bg-primary border-primary" : "bg-surface border-outline-variant"
                            }`}
                            onPress={() => updateCartItem(item.id, "bird_size", size)}
                          >
                            <Text className={active ? "text-on-primary font-semibold" : "text-on-surface"}>
                              {size}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <Text className="font-label-md text-on-surface-variant mb-2">Notes (optional)</Text>
                    <TextInput
                      className="bg-surface border border-outline-variant rounded-xl px-3 py-3 text-body-md text-on-surface min-h-[60px] placeholder:text-on-surface-variant"
                      value={cartItem?.notes || ""}
                      onChangeText={(v) => updateCartItem(item.id, "notes", v)}
                      placeholder="Delivery instructions, cut preference, etc."
                    />
                  </>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Floating Action Button for total summary */}
      <View className="absolute bottom-4 left-4 right-4 max-w-3xl mx-auto">
        <Pressable accessibilityRole="button"
          className="bg-primary h-14 rounded-2xl flex-row items-center justify-between px-6 shadow-md"
          onPress={onSubmit}
          disabled={busy || totalKg === 0}
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="shopping-cart" size={20} color="white" />
            <Text className="text-on-primary font-semibold text-lg">{totalKg} kg Total</Text>
          </View>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-on-primary font-bold text-lg">Confirm Order</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
