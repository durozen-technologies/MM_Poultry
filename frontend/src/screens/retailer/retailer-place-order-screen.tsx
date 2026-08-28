import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRetailerCart } from "../../hooks/use-retailer-cart";

const BIRD_SIZES = ["Small", "Medium", "Large", "XL"];

export function RetailerPlaceOrderScreen({ navigation }: { navigation: any }) {
  const {
    cart,
    busy,
    message,
    items,
    loadingItems,
    totalBoxes,
    updateCartItem,
    adjustBoxes,
    onSubmit,
  } = useRetailerCart(() => navigation.goBack());

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-[#0052CC] border-b border-black/10">
        <Pressable accessibilityRole="button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full active:bg-white/10" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-white" />
        </Pressable>
        <Text className="font-headline-sm text-white font-semibold ml-2">Place Order</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {message ? (
          <View className="bg-error-container rounded-lg px-3 py-2 mb-3">
            <Text className="text-error text-center">{message}</Text>
          </View>
        ) : null}

        {loadingItems ? (
          <ActivityIndicator color="#0052CC" size="large" className="mt-8" />
        ) : items.length === 0 ? (
          <Text className="text-center text-on-surface-variant mt-8">No items available to order.</Text>
        ) : (
          items.map((item: any) => {
            const cartItem = cart[item.id];
            const qty = cartItem ? String(cartItem.total_boxes || 0) : "0";
            const expectedKg = cartItem ? cartItem.requested_kg : "";
            const isSelected = Number(qty) > 0;

            return (
              <View key={item.id} className={`bg-white rounded-2xl p-5 mb-4 shadow-sm elevation-sm border ${isSelected ? "border-[#0052CC] border-[2px]" : "border-black/5"}`}>
                <Text className="font-headline-sm text-on-surface mb-1">{item.name}</Text>
                {item.description ? <Text className="font-body-sm text-on-surface-variant mb-3">{item.description}</Text> : <View className="mb-2" />}

                <Text className="font-label-md text-on-surface-variant uppercase font-semibold mb-2">Boxes Count</Text>
                <View className="flex-row items-center justify-between mb-4">
                  <Pressable accessibilityRole="button"
                    className="w-14 h-14 rounded-full bg-surface-container-highest items-center justify-center active:opacity-70"
                    onPress={() => adjustBoxes(item.id, -1)}
                  >
                    <MaterialIcons name="remove" size={28} className="text-on-surface" />
                  </Pressable>
                  <TextInput
                    className="flex-1 mx-4 text-center font-display-sm font-bold text-[#0052CC] border border-outline-variant/50 bg-surface-container-lowest rounded-xl py-4"
                    value={qty}
                    onChangeText={(v) => {
                       const num = parseInt(v, 10);
                       updateCartItem(item.id, "total_boxes", isNaN(num) ? 0 : num);
                    }}
                    keyboardType="number-pad"
                  />
                  <Pressable accessibilityRole="button"
                    className="w-14 h-14 rounded-full bg-[#0052CC] items-center justify-center active:opacity-70 shadow-sm"
                    onPress={() => adjustBoxes(item.id, 1)}
                  >
                    <MaterialIcons name="add" size={28} className="text-white" />
                  </Pressable>
                </View>

                {isSelected && (
                  <>
                    <Text className="font-label-md text-on-surface-variant mb-2">Expected Kg (Optional)</Text>
                    <TextInput
                      className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 py-3 text-body-lg text-[#0052CC] font-bold mb-4"
                      value={expectedKg || ""}
                      onChangeText={(v) => updateCartItem(item.id, "requested_kg", v)}
                      keyboardType="decimal-pad"
                      placeholder="e.g. 50"
                    />
                    
                    <Text className="font-label-md text-on-surface-variant mb-3">Bird size</Text>
                    <View className="flex-row flex-wrap gap-2 mb-4">
                      {BIRD_SIZES.map((size) => {
                        const active = cartItem?.bird_size === size;
                        return (
                          <Pressable accessibilityRole="button"
                            key={size}
                            className={`px-5 py-2.5 rounded-full border ${
                              active ? "bg-[#0052CC] border-[#0052CC]" : "bg-surface-container-lowest border-outline-variant/40"
                            }`}
                            onPress={() => updateCartItem(item.id, "bird_size", size)}
                          >
                            <Text className={active ? "text-white font-bold tracking-wide" : "text-on-surface"}>
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
          className="bg-[#0052CC] h-[60px] rounded-[20px] flex-row items-center justify-between px-6 shadow-md elevation-sm"
          onPress={onSubmit}
          disabled={busy || totalBoxes === 0}
        >
          <View className="flex-row items-center gap-2">
            <MaterialIcons name="shopping-cart" size={20} color="white" />
            <Text className="text-on-primary font-semibold text-lg">{totalBoxes} Boxes Total</Text>
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
