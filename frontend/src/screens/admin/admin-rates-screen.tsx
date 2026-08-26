import React, { useState, useEffect } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { apiItems } from "../../api/items";
import { listRates, upsertRate } from "../../api/rates";
import type { Item, Rate } from "../../types/api";

export function AdminRatesScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [defaultRateInput, setDefaultRateInput] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const { data: itemsPage, isLoading: loadingItems } = useQuery({
    queryKey: ["admin_items", { activeOnly: true }],
    queryFn: () => apiItems.list(true),
  });

  const items = itemsPage?.items || [];

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const { data: rates = [], isLoading: loadingRates } = useQuery({
    queryKey: ["admin_rates", selectedItemId],
    queryFn: () => (selectedItemId ? listRates(selectedItemId) : Promise.resolve([])),
    enabled: !!selectedItemId,
  });

  useEffect(() => {
    if (rates.length > 0) {
      const global = rates.find((r) => !r.retailer_id);
      if (global) {
        setDefaultRateInput(global.rate_per_kg);
      } else {
        const item = items.find((i: any) => i.id === selectedItemId);
        if (item) setDefaultRateInput(item.default_price);
      }
    } else if (selectedItemId) {
        const item = items.find((i: any) => i.id === selectedItemId);
        if (item) setDefaultRateInput(item.default_price);
    }
  }, [rates, selectedItemId, items]);

  const saveRateMutation = useMutation({
    mutationFn: (payload: { item_id: string; rate_per_kg: string }) => upsertRate(payload),
    onSuccess: () => {
      setMsg("Default rate saved successfully");
      queryClient.invalidateQueries({ queryKey: ["admin_rates", selectedItemId] });
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
    },
    onError: (e) => {
      setMsg(e instanceof Error ? e.message : "Failed to save rate");
    }
  });

  const saveDefaultRate = () => {
    if (!selectedItemId || !defaultRateInput) return;
    saveRateMutation.mutate({ item_id: selectedItemId, rate_per_kg: defaultRateInput });
  };

  const selectedItem = items.find((i: any) => i.id === selectedItemId);

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Rates</Text>
      </View>

      <View className="p-4 bg-surface border-b border-outline-variant/20">
        <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-2">Select Item</Text>
        {loadingItems ? (
          <ActivityIndicator color="#012D1D" />
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => setSelectedItemId(item.id)}
                className={`px-4 py-2 rounded-full mr-2 border ${
                  selectedItemId === item.id 
                    ? "bg-primary border-primary" 
                    : "bg-surface border-outline-variant"
                }`}
              >
                <Text className={`font-semibold ${
                  selectedItemId === item.id ? "text-on-primary" : "text-on-surface"
                }`}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        )}
      </View>

      <FlatList
        data={rates}
        keyExtractor={(r) => r.id}
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

            {selectedItemId && (
              <View className="bg-surface-container-lowest rounded-2xl p-4 mb-4 border border-outline-variant/20">
                <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-3">
                  Default Rate for {selectedItem?.name} (₹/kg)
                </Text>
                <TextInput placeholderTextColor="#737373"
                  className="bg-surface h-12 border border-outline-variant rounded-lg px-3 text-body-md mb-3 text-on-surface"
                  value={defaultRateInput}
                  onChangeText={setDefaultRateInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
                <Pressable accessibilityRole="button" className="bg-primary h-11 rounded-lg items-center justify-center" onPress={saveDefaultRate}>
                  {saveRateMutation.isPending ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-on-primary font-semibold">Save Default Rate</Text>
                  )}
                </Pressable>
              </View>
            )}

            <Text className="font-headline-sm text-on-surface font-semibold mb-3">All Rates</Text>
            {loadingRates ? (
              <ActivityIndicator className="text-primary" />
            ) : rates.length === 0 ? (
              <Text className="text-on-surface-variant text-center py-8">No rates configured yet.</Text>
            ) : null}
          </>
        }
        renderItem={({ item: rate }) => (
          <View className="bg-surface-container-lowest rounded-xl p-4 mb-2 border border-outline-variant/20">
            <Text className="font-body-md text-on-surface font-semibold">
              {rate.retailer_id ? `Retailer ${rate.retailer_id.slice(0, 8)}` : "Default (all retailers)"}
            </Text>
            <Text className="font-headline-sm text-primary mt-1">₹{rate.rate_per_kg}/kg</Text>
            <Text className="font-label-md text-on-surface-variant mt-1">From {rate.effective_from}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
