import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialIcons } from "@expo/vector-icons";
import { apiItems } from "../../api/items";
import { listRates, upsertRate } from "../../api/rates";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminRatesScreen({ navigation }: { navigation: any }) {
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [defaultRateInput, setDefaultRateInput] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { data: itemsPage, isLoading: loadingItems, refetch: refetchItems } = useQuery({
    queryKey: ["admin_items", { activeOnly: true }],
    queryFn: () => apiItems.list(true),
  });

  const items = itemsPage?.items || [];

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  const { data: rates = [], isLoading: loadingRates, refetch: refetchRates, isRefetching } = useQuery({
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
      setMsg({ text: "Default rate saved successfully", type: 'success' });
      queryClient.invalidateQueries({ queryKey: ["admin_rates", selectedItemId] });
      queryClient.invalidateQueries({ queryKey: ["admin_items"] });
      
      // Clear message after 3 seconds
      setTimeout(() => setMsg(null), 3000);
    },
    onError: (e) => {
      setMsg({ text: e instanceof Error ? e.message : "Failed to save rate", type: 'error' });
      
      // Clear message after 3 seconds
      setTimeout(() => setMsg(null), 3000);
    }
  });

  const saveDefaultRate = () => {
    if (!selectedItemId || !defaultRateInput) return;
    saveRateMutation.mutate({ item_id: selectedItemId, rate_per_kg: defaultRateInput });
  };

  const selectedItem = useMemo(() => items.find((i: any) => i.id === selectedItemId), [items, selectedItemId]);

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Product Rates" 
          subtitle="Manage pricing for inventory items"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              onPress={() => {
                refetchItems();
                if (selectedItemId) refetchRates();
              }}
            >
              {(loadingItems || isRefetching) ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      {/* Item Selection Strip */}
      <View className="bg-surface-container-lowest border-b border-outline-variant/30 py-3 shadow-sm z-10">
        {loadingItems ? (
          <View className="h-10 justify-center">
            <ActivityIndicator color="#115E29" />
          </View>
        ) : (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={({ item }) => <ItemSelectionBadge item={item} isSelected={selectedItemId === item.id} onSelect={setSelectedItemId} />}
          />
        )}
      </View>

      <FlatList
        data={rates}
        keyExtractor={(r) => r.id}
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View className="pt-6 mb-2">
              {msg && (
                <View className={`p-4 rounded-xl mb-4 flex-row items-center border ${
                  msg.type === 'success' 
                    ? 'bg-primary-container/30 border-primary/20' 
                    : 'bg-error-container/30 border-error/20'
                }`}>
                  <MaterialIcons 
                    name={msg.type === 'success' ? "check-circle" : "error-outline"} 
                    size={20} 
                    className={msg.type === 'success' ? "text-primary mr-2" : "text-error mr-2"} 
                  />
                  <Text className={`font-label-md font-semibold flex-1 ${
                    msg.type === 'success' ? 'text-primary' : 'text-error'
                  }`}>
                    {msg.text}
                  </Text>
                </View>
              )}

              {selectedItemId && selectedItem && (
                <View className="mb-8">
                  <AdminCard 
                    title={`${selectedItem.name} Rate`} 
                    icon="price-change" 
                    iconColorClass="text-primary" 
                    iconBgClass="bg-primary/10"
                  >
                    <View className="flex-col gap-4">
                      <View>
                        <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1 uppercase tracking-wider">
                          Default Rate (₹ / KG)
                        </Text>
                        <View className="relative flex-row items-center">
                          <View className="absolute left-4 z-10">
                            <Text className="font-title-lg text-on-surface-variant font-bold">₹</Text>
                          </View>
                          <TextInput 
                            placeholderTextColor="#9ca3af"
                            className="w-full bg-surface-container-lowest h-16 rounded-2xl border border-outline-variant/50 pl-10 pr-4 font-display-sm text-primary font-black focus:border-primary shadow-sm"
                            value={defaultRateInput}
                            onChangeText={setDefaultRateInput}
                            placeholder="0.00"
                            keyboardType="decimal-pad"
                          />
                        </View>
                      </View>
                      
                      <Pressable 
                        accessibilityRole="button" 
                        className={`h-14 rounded-2xl flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                          !defaultRateInput.trim() ? "bg-surface-variant" : "bg-primary shadow-sm shadow-primary/30"
                        }`}
                        onPress={saveDefaultRate}
                        disabled={saveRateMutation.isPending || !defaultRateInput.trim()}
                      >
                        {saveRateMutation.isPending ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <>
                            <MaterialIcons name="save" size={20} color={!defaultRateInput.trim() ? "#717973" : "white"} />
                            <Text className={`font-bold text-label-lg ${!defaultRateInput.trim() ? "text-on-surface-variant" : "text-white"}`}>
                              Update Global Rate
                            </Text>
                          </>
                        )}
                      </Pressable>
                    </View>
                  </AdminCard>
                </View>
              )}

              <View className="flex-row items-center justify-between ml-1 mb-4">
                <Text className="font-title-lg text-on-surface font-bold">Active Rates</Text>
                {rates.length > 0 && (
                  <View className="bg-surface-container-highest px-3 py-1 rounded-full">
                    <Text className="font-label-sm text-on-surface-variant font-bold">{rates.length} Rates</Text>
                  </View>
                )}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loadingRates ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" className="text-primary mb-4" />
              <Text className="text-on-surface-variant font-medium">Loading rates...</Text>
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center mb-6">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="price-check" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">No Rates Found</Text>
              <Text className="font-body-md text-on-surface-variant text-center max-w-[250px]">
                {selectedItemId ? "There are no rate overrides for this item." : "Select an item to view its rates."}
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={ItemSeparator}
        renderItem={({ item: rate }) => <RateListItem rate={rate} />}
      />
    </AdminScreenContainer>
  );
}

const ItemSelectionBadge = React.memo(({ item, isSelected, onSelect }: { item: any; isSelected: boolean; onSelect: (id: string) => void }) => {
  return (
    <Pressable
      onPress={() => onSelect(item.id)}
      className={`px-5 py-2.5 rounded-full border flex-row items-center transition-colors ${
        isSelected 
          ? "bg-primary border-primary shadow-sm shadow-primary/30" 
          : "bg-surface border-outline-variant/50"
      }`}
    >
      {isSelected && (
        <MaterialIcons name="check" size={16} color="white" className="mr-1.5" />
      )}
      <Text className={`font-bold ${
        isSelected ? "text-white" : "text-on-surface-variant"
      }`}>
        {item.name}
      </Text>
    </Pressable>
  );
});

const ItemSeparator = React.memo(() => <View className="h-3" />);

const RateListItem = React.memo(({ rate }: { rate: any }) => {
  return (
    <View className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/20 flex-row items-center justify-between relative overflow-hidden">
      <View className={`absolute top-0 left-0 w-1.5 h-full ${!rate.retailer_id ? 'bg-primary' : 'bg-tertiary'}`} />
      
      <View className="flex-1 ml-2">
        <View className="flex-row items-center gap-2 mb-1">
          <MaterialIcons name={!rate.retailer_id ? "public" : "storefront"} size={16} className="text-on-surface-variant" />
          <Text className="font-title-sm text-on-surface font-bold">
            {rate.retailer_id ? `Retailer #${rate.retailer_id.slice(0, 8)}` : "Global Default"}
          </Text>
          {!rate.retailer_id && (
            <View className="bg-primary/10 px-2 py-0.5 rounded ml-2 border border-primary/20">
              <Text className="text-primary text-[10px] uppercase font-bold tracking-wider">All Retailers</Text>
            </View>
          )}
        </View>
        <Text className="font-label-sm text-on-surface-variant font-medium">
          Effective: <Text className="font-bold">{rate.effective_from}</Text>
        </Text>
      </View>
      
      <View className="items-end bg-surface-container-highest/30 px-4 py-2 rounded-xl border border-outline-variant/10">
        <Text className="font-label-sm text-on-surface-variant uppercase font-bold tracking-wider mb-0.5">Rate / KG</Text>
        <Text className="font-title-lg text-primary font-black">₹{rate.rate_per_kg}</Text>
      </View>
    </View>
  );
});
