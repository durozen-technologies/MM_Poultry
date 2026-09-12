import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, FlatList, Modal } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useAdminCart } from "../../hooks/use-admin-cart";
import { listRetailers } from "../../api/retailers";
import type { Retailer } from "../../types/api";
import { DatePickerField } from "../../components/date-picker-field";
import { todayIstDate } from "../../utils/ist-date";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

const OrderItemRow = React.memo(({ item, cartItem, onAdjust, onUpdate }: any) => {
  const qty = cartItem ? String(cartItem.total_boxes || 0) : "0";
  const expectedKg = cartItem ? cartItem.requested_kg : "";
  const isSelected = Number(qty) > 0;

  const handleMinus = useCallback(() => onAdjust(item.id, -1), [item.id, onAdjust]);
  const handlePlus = useCallback(() => onAdjust(item.id, 1), [item.id, onAdjust]);
  const handleQtyChange = useCallback((v: string) => {
    const num = parseInt(v, 10);
    onUpdate(item.id, "total_boxes", isNaN(num) ? 0 : num);
  }, [item.id, onUpdate]);
  const handleKgChange = useCallback((v: string) => onUpdate(item.id, "requested_kg", v), [item.id, onUpdate]);

  return (
    <View className={`bg-white rounded-2xl p-5 mb-4 shadow-sm elevation-sm border ${isSelected ? "border-[#003E99] border-[2px]" : "border-black/5"}`}>
      <Text className="font-headline-sm text-on-surface mb-1">{item.name}</Text>
      {item.description ? <Text className="font-body-sm text-on-surface-variant mb-3">{item.description}</Text> : <View className="mb-2" />}

      <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-2">Boxes Count</Text>
      <View className="flex-row items-center justify-between mb-4">
        <Pressable accessibilityRole="button"
          className="w-14 h-14 rounded-full bg-surface-container-highest items-center justify-center active:opacity-70"
          onPress={handleMinus}
        >
          <MaterialIcons name="remove" size={28} className="text-on-surface" />
        </Pressable>
        <TextInput
          className="flex-1 mx-4 text-center font-display-sm font-bold text-[#003E99] border border-outline-variant/50 bg-surface-container-lowest rounded-xl py-4"
          value={qty}
          onChangeText={handleQtyChange}
          keyboardType="number-pad"
        />
        <Pressable accessibilityRole="button"
          className="w-14 h-14 rounded-full bg-[#003E99] items-center justify-center active:opacity-70 shadow-sm"
          onPress={handlePlus}
        >
          <MaterialIcons name="add" size={28} className="text-white" />
        </Pressable>
      </View>

      {isSelected && (
        <>
          <Text className="font-label-md text-on-surface-variant mb-2">Expected Kg (Optional)</Text>
          <TextInput
            className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 text-body-lg text-[#003E99] font-bold"
            value={expectedKg || ""}
            onChangeText={handleKgChange}
            keyboardType="decimal-pad"
            placeholder="e.g. 50"
          />
        </>
      )}
    </View>
  );
});

export function AdminNewOrderScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 400);

  const { data: retailersPage, isLoading: loadingRetailers } = useQuery({
    queryKey: ["admin_retailers_search", debouncedSearch],
    queryFn: () => listRetailers(undefined, 20, debouncedSearch),
  });

  const handleGoBack = useCallback(() => {
    if (selectedRetailer) {
      setSelectedRetailer(null);
    } else {
      navigation.goBack();
    }
  }, [navigation, selectedRetailer]);

  const onOrderSuccess = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const {
    cart,
    busy,
    message,
    items,
    loadingItems,
    totalBoxes,
    orderNotes,
    setOrderNotes,
    expectedDeliveryDate,
    setExpectedDeliveryDate,
    updateCartItem,
    adjustBoxes,
    onSubmit,
  } = useAdminCart(selectedRetailer?.id || null, onOrderSuccess);

  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);

  return (
    <View className="flex-1 max-w-3xl mx-auto w-full bg-background" style={{ paddingTop: insets.top }}>
      <View className="h-16 px-4 flex-row items-center bg-[#003E99] border-b border-black/10">
        <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full active:bg-white/10" onPress={handleGoBack}>
          <MaterialIcons name="arrow-back" size={24} className="text-white" />
        </Pressable>
        <Text className="font-headline-sm text-white font-semibold ml-2">New Order</Text>
      </View>

      {!selectedRetailer ? (
        <View className="flex-1">
          <View className="p-4 bg-white border-b border-outline-variant/30">
            <View className="flex-row items-center bg-surface-container-low rounded-xl px-3 h-12">
              <MaterialIcons name="search" size={20} className="text-on-surface-variant" />
              <TextInput
                className="flex-1 ml-2 text-body-lg text-on-surface"
                placeholder="Search company, shop, or mobile..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")} className="p-1">
                  <MaterialIcons name="close" size={20} className="text-on-surface-variant" />
                </Pressable>
              )}
            </View>
          </View>

          {loadingRetailers ? (
            <ActivityIndicator color="#003E99" size="large" className="mt-8" />
          ) : (
            <FlatList
              data={retailersPage?.items || []}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
              renderItem={({ item: retailer }) => (
                <Pressable
                  className="bg-white p-4 rounded-2xl mb-3 shadow-sm border border-black/5 active:opacity-70 flex-row items-center"
                  onPress={() => setSelectedRetailer(retailer)}
                >
                  <View className="w-12 h-12 rounded-full bg-[#003E99]/10 items-center justify-center mr-4">
                    <Text className="text-[#003E99] font-bold text-lg">{retailer.name.charAt(0)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-headline-sm text-on-surface">{retailer.name}</Text>
                    {retailer.shop_name && <Text className="font-body-md text-on-surface-variant">{retailer.shop_name}</Text>}
                    <Text className="font-body-sm text-on-surface-variant mt-1 flex-row items-center">
                      <MaterialIcons name="phone" size={14} className="text-on-surface-variant" /> {retailer.phone}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
                </Pressable>
              )}
              ListEmptyComponent={
                <Text className="text-center text-on-surface-variant mt-8">
                  {searchQuery ? "No retailers found." : "Type to search retailers."}
                </Text>
              }
            />
          )}
        </View>
      ) : (
        <View className="flex-1">
          <View className="bg-surface-container-lowest px-4 py-3 border-b border-outline-variant/30">
            <Text className="text-label-md text-on-surface-variant uppercase font-semibold">Ordering For</Text>
            <Text className="text-headline-sm text-[#003E99] font-bold">{selectedRetailer.name}</Text>
            <Text className="text-body-sm text-on-surface-variant">{selectedRetailer.phone}</Text>
          </View>
          
          {message ? (
            <View className="bg-error-container rounded-lg px-3 py-2 mb-3 mt-4 mx-4">
              <Text className="text-error text-center">{message}</Text>
            </View>
          ) : null}
          
          {loadingItems ? (
            <ActivityIndicator color="#003E99" size="large" className="mt-8" />
          ) : items.length === 0 ? (
            <Text className="text-center text-on-surface-variant mt-8">No items available to order.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item: any) => item.id}
              className="flex-1 px-4 py-4"
              contentContainerStyle={{ paddingBottom: 100 }}
              renderItem={({ item }: { item: any }) => (
                <OrderItemRow
                  item={item}
                  cartItem={cart[item.id]}
                  onAdjust={adjustBoxes}
                  onUpdate={updateCartItem}
                />
              )}
            />
          )}

          {/* Floating Action Button for total summary */}
          <View className="absolute bottom-4 left-4 right-4 max-w-3xl mx-auto">
            <Pressable accessibilityRole="button"
              className="bg-primary h-14 rounded-full flex-row items-center justify-between px-6 shadow-sm shadow-primary/30 active:scale-[0.98] transition-transform"
              onPress={() => setIsConfirmModalVisible(true)}
              disabled={busy || totalBoxes === 0}
            >
              <View className="flex-row items-center gap-2">
                <MaterialIcons name="shopping-cart" size={20} color="white" />
                <Text className="text-on-primary font-semibold text-lg">{totalBoxes} Boxes Total</Text>
              </View>
              <Text className="text-on-primary font-bold text-lg">Place Order</Text>
            </Pressable>
          </View>

          <Modal visible={isConfirmModalVisible} transparent animationType="slide">
            <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white rounded-t-3xl p-6" style={{ paddingBottom: Math.max(insets.bottom + 24, 24) }}>
                <View className="flex-row justify-between items-center mb-6">
                  <Text className="font-headline-sm text-on-surface font-bold">Confirm Order</Text>
                  <Pressable onPress={() => setIsConfirmModalVisible(false)} className="p-2 -mr-2">
                    <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
                  </Pressable>
                </View>

                <ScrollView className="max-h-48 mb-4">
                  {Object.values(cart)
                    .filter((it) => (it.total_boxes || 0) > 0)
                    .map((it) => {
                      const itemData = items.find((i: any) => i.id === it.item_id);
                      const itemName = itemData ? itemData.name : "Unknown Item";
                      const kgs = Number(it.requested_kg);
                      const kgsText = kgs > 0 ? ` (${kgs} Kg)` : "";
                      return (
                        <Text key={it.item_id} className="text-body-lg text-on-surface mb-2">
                          • {itemName} - {it.total_boxes} Boxes{kgsText}
                        </Text>
                      );
                    })}
                </ScrollView>

                <DatePickerField
                  label="Select the Estimated delivery"
                  value={expectedDeliveryDate}
                  onChange={setExpectedDeliveryDate}
                  minimumDate={todayIstDate()}
                  containerStyle="mb-4"
                  inputStyle="bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3"
                  showIcon
                />

                <Text className="font-label-md text-on-surface-variant mb-2">Order Notes (Optional)</Text>
                <TextInput
                  className="bg-surface border border-outline-variant rounded-xl px-4 py-3 text-body-lg text-on-surface min-h-[100px] mb-6 placeholder:text-on-surface-variant"
                  value={orderNotes}
                  onChangeText={setOrderNotes}
                  placeholder="Add any delivery instructions or cut preferences..."
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  accessibilityRole="button"
                  className="bg-[#003E99] h-14 rounded-xl flex-row items-center justify-center shadow-sm active:opacity-80"
                  onPress={() => {
                    setIsConfirmModalVisible(false);
                    onSubmit();
                  }}
                >
                  <Text className="text-white font-bold text-lg">Confirm the order</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </View>
  );
}
