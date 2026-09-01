import {
  Pressable,
  Text,
  View,
  ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAdminInventory } from "../../hooks/use-queries";

export function AdminFarmsScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const { data: inventoryData, isLoading: isInventoryLoading } = useAdminInventory();

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      {/* Header */}
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/90 z-20">
        <View className="flex-row items-center gap-2">
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full active:bg-surface-variant/50"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
          </Pressable>
          <Text className="font-headline-sm text-headline-sm text-primary font-semibold">
            Farms Dashboard
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Action buttons moved to body */}
        </View>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Action Buttons */}
        <View className="flex-row items-center justify-between mb-8 gap-3">
          <Pressable
            className="flex-1 h-14 bg-white border border-[#15803D] rounded-xl flex-row items-center justify-center active:bg-gray-50"
            onPress={() => navigation.navigate("FarmPurchase")}
          >
            <Text className="text-[#15803D] font-bold text-base">New Load</Text>
          </Pressable>
          <Pressable
            className="flex-1 h-14 bg-[#115E29] rounded-xl flex-row items-center justify-center active:bg-[#0f5223]"
            onPress={() => navigation.navigate("AdminFarmsInfo")}
          >
            <Text className="text-white font-bold text-base">Farms Info</Text>
          </Pressable>
        </View>

        {/* Inventory Status */}
        <View className="flex-row items-center mb-5 mt-2">
          <Text className="font-headline-sm text-on-surface font-semibold mr-4">Inventory Status</Text>
          <View className="flex-1 h-[1px] bg-outline-variant/30" />
        </View>
        
        {isInventoryLoading ? (
          <View className="mb-6 items-center py-4">
            <Text className="text-on-surface-variant">Loading inventory...</Text>
          </View>
        ) : inventoryData?.items && inventoryData.items.length > 0 ? (
          <View className="flex-row flex-wrap justify-between mb-6">
            {inventoryData.items.map((inv) => (
              <Pressable 
                key={inv.item_id}
                onPress={() => navigation.navigate("AdminInventoryDetail", { itemId: inv.item_id, itemName: inv.item_name })}
                className="bg-white rounded-2xl p-4 w-[48%] mb-4 border border-outline-variant/20 shadow-sm active:bg-gray-50 flex-col"
              >
                <Text className="text-gray-700 font-semibold text-xs mb-3 uppercase tracking-wide">{inv.item_name}</Text>
                <Text className="text-[#115E29] font-bold text-[22px] mb-4">
                  {Number(inv.total_available_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })} KG
                </Text>
                <View className="bg-[#F0FDF4] rounded-lg py-2.5 items-center justify-center mt-auto">
                  <Text className="text-[#115E29] text-xs font-semibold">Tap for active loads ➔</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="bg-surface-container-lowest rounded-2xl p-4 mb-6 border border-dashed border-outline-variant items-center">
            <Text className="font-body-md text-on-surface-variant">No active inventory available.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
