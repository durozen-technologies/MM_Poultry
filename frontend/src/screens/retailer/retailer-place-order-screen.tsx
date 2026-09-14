import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, FlatList, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRetailerCart } from "../../hooks/use-retailer-cart";
import type { Item } from "../../types/api";



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

export function RetailerPlaceOrderScreen({ navigation, route }: { navigation: any; route: any }) {
  const orderId = route.params?.orderId;
  const insets = useSafeAreaInsets();
  
  const handleGoBack = useCallback(() => navigation.goBack(), [navigation]);
  const {
    cart,
    busy,
    message,
    items,
    loadingItems,
    totalBoxes,
    orderNotes,
    setOrderNotes,
    updateCartItem,
    adjustBoxes,
    onSubmit,
  } = useRetailerCart(handleGoBack, orderId);

  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);


  return (
    <KeyboardAvoidingView 
      className="flex-1 bg-background" 
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
    >
      <View className="flex-1 max-w-3xl mx-auto w-full" style={{ paddingTop: insets.top }}>
        <View className="h-16 px-4 flex-row items-center bg-[#003E99] border-b border-black/10">
          <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full active:bg-white/10" onPress={handleGoBack}>
            <MaterialIcons name="arrow-back" size={24} className="text-white" />
          </Pressable>
          <Text className="font-headline-sm text-white font-semibold ml-2">Place Order</Text>
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
            keyboardShouldPersistTaps="handled"
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


      {/* Action Button for total summary */}
      <View className="px-4 pb-4 pt-2 bg-background">
        <View className="bg-white h-16 rounded-2xl flex-row items-center justify-between shadow-sm border border-black/5 overflow-hidden elevation-sm">
          <View className="flex-1 flex-row items-center px-4 py-2">
            <MaterialIcons name="shopping-cart" size={24} className="text-[#003E99]" />
            <View className="ml-3">
              <Text className="text-[#003E99] font-bold text-xs uppercase tracking-wider">Total Order</Text>
              <Text className="text-[#003E99] font-black text-xl">{totalBoxes} <Text className="text-sm font-bold">Boxes</Text></Text>
            </View>
          </View>
          <Pressable accessibilityRole="button"
            className={`h-full px-8 items-center justify-center ${busy || totalBoxes === 0 ? 'bg-[#2E7D32]/50' : 'bg-[#2E7D32]'}`}
            onPress={() => setIsConfirmModalVisible(true)}
            disabled={busy || totalBoxes === 0}
          >
            <Text className="text-white font-bold text-lg uppercase tracking-wider">Confirm Order</Text>
          </Pressable>
        </View>
      </View>

        <Modal visible={isConfirmModalVisible} transparent animationType="slide">
          <KeyboardAvoidingView 
            className="flex-1 bg-black/50 justify-center items-center px-4"
            behavior={Platform.OS === "ios" ? "padding" : "padding"}
          >
            <View className="bg-white rounded-3xl p-6 w-full max-w-md">
              <View className="flex-row justify-between items-center mb-6">
                <Text className="font-headline-sm text-on-surface font-bold">Preview Order</Text>
                <Pressable onPress={() => setIsConfirmModalVisible(false)} className="p-2 -mr-2 bg-surface-container rounded-full active:bg-outline-variant/20">
                  <MaterialIcons name="close" size={24} className="text-on-surface-variant" />
                </Pressable>
              </View>

              <View className="mb-6 max-h-[250px]">
                <ScrollView showsVerticalScrollIndicator={false}>
                  {Object.entries(cart).map(([itemId, cartItem]: [string, any]) => {
                    const item = items.find(i => i.id === itemId);
                    if (!item || !cartItem.total_boxes) return null;
                    return (
                      <View key={itemId} className="flex-row justify-between items-center bg-[#f7f8fa] p-4 rounded-xl mb-3 border border-outline-variant/10">
                        <View className="flex-1 mr-4">
                          <Text className="font-bold text-base text-[#202124]">{item.name}</Text>
                          {cartItem.requested_kg && Number(cartItem.requested_kg) > 0 ? (
                            <Text className="text-xs font-bold text-[#5f6368] mt-1">Expected: {cartItem.requested_kg} KG</Text>
                          ) : null}
                        </View>
                        <View className="flex-row items-end gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#2E7D32] bg-[#2E7D32]/5">
                          <Text className="text-lg font-black text-[#2E7D32]">{cartItem.total_boxes}</Text>
                          <Text className="text-xs font-bold text-[#2E7D32] mb-1">BOXES</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>

              <Text className="font-label-md text-on-surface-variant mb-2 font-bold uppercase tracking-wider text-xs">Order Notes (Optional)</Text>
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
                className="bg-[#2E7D32] h-14 rounded-xl flex-row items-center justify-center shadow-sm active:opacity-90"
                onPress={() => {
                  setIsConfirmModalVisible(false);
                  onSubmit();
                }}
              >
                <MaterialIcons name="check-circle" size={20} color="white" className="mr-2" />
                <Text className="text-white font-bold text-lg uppercase tracking-wider">Place Order</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}
