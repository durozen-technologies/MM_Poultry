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
import { getTodayOrder, upsertTodayOrder } from "../../api/retailer";

const BIRD_SIZES = ["Small", "Medium", "Large", "XL"];

export function RetailerPlaceOrderScreen({ navigation }: { navigation: any }) {
  const [kg, setKg] = useState("50");
  const [birdSize, setBirdSize] = useState<string | null>("Medium");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadExisting = useCallback(async () => {
    try {
      const order = await getTodayOrder();
      if (order) {
        setKg(order.requested_kg);
        setBirdSize(order.bird_size || null);
        setNotes(order.notes || "");
      }
    } catch {
      // ignore preload errors
    }
  }, []);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  async function onSubmit() {
    const qty = Number(kg);
    if (!qty || qty <= 0) {
      setMessage("Enter a valid quantity in kg");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await upsertTodayOrder({
        requested_kg: kg,
        bird_size: birdSize,
        notes: notes.trim() || null,
      });
      navigation.goBack();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save order");
    } finally {
      setBusy(false);
    }
  }

  function adjustKg(delta: number) {
    const next = Math.max(1, Number(kg || 0) + delta);
    setKg(String(next));
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-11 h-11 -ml-2 items-center justify-center rounded-full"
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Place Order</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {message ? (
          <View className="bg-error-container rounded-lg px-3 py-2 mb-3">
            <Text className="text-error text-center">{message}</Text>
          </View>
        ) : null}

        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
          <Text className="font-label-md text-on-surface-variant mb-2">Quantity (kg)</Text>
          <View className="flex-row items-center justify-between mb-2">
            <Pressable accessibilityRole="button" accessibilityLabel="Button"
              className="w-12 h-12 rounded-full bg-surface-variant items-center justify-center"
              onPress={() => adjustKg(-5)}
            >
              <MaterialIcons name="remove" size={24} className="text-on-surface" />
            </Pressable>
            <TextInput
              className="flex-1 mx-3 text-center font-display-md text-on-surface border border-outline-variant rounded-xl py-3"
              value={kg}
              onChangeText={setKg}
              keyboardType="decimal-pad"
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Button"
              className="w-12 h-12 rounded-full bg-surface-variant items-center justify-center"
              onPress={() => adjustKg(5)}
            >
              <MaterialIcons name="add" size={24} className="text-on-surface" />
            </Pressable>
          </View>
        </View>

        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
          <Text className="font-label-md text-on-surface-variant mb-3">Bird size</Text>
          <View className="flex-row flex-wrap gap-2">
            {BIRD_SIZES.map((size) => {
              const active = birdSize === size;
              return (
                <Pressable accessibilityRole="button" accessibilityLabel="Button"
                  key={size}
                  className={`px-4 py-2 rounded-full border ${
                    active ? "bg-primary border-primary" : "bg-surface border-outline-variant"
                  }`}
                  onPress={() => setBirdSize(size)}
                >
                  <Text className={active ? "text-on-primary font-semibold" : "text-on-surface"}>
                    {size}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
          <Text className="font-label-md text-on-surface-variant mb-2">Notes (optional)</Text>
          <TextInput
            className="bg-surface border border-outline-variant rounded-xl px-3 py-3 text-body-md text-on-surface min-h-[88px] placeholder:text-on-surface-variant"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Delivery instructions, cut preference, etc."
 />
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="bg-primary h-12 rounded-xl items-center justify-center"
          onPress={onSubmit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-on-primary font-semibold">Save today&apos;s order</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
