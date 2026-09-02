import {
  Pressable,
  Text,
  View,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminInventory } from "../../hooks/use-queries";
import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminFarmsScreen({ navigation }: { navigation: any }) {
  const { data: inventoryData, isLoading: isInventoryLoading } = useAdminInventory();

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Farms Dashboard" 
          subtitle="Manage farm loads and active inventory"
          onBack={() => navigation.goBack()} 
        />
      }
    >
      <View className="flex-col gap-6">
        
        {/* Action Buttons */}
        <View className="flex-row items-center justify-between gap-4">
          <Pressable
            className="flex-1 h-14 bg-surface-container-lowest border border-primary/30 rounded-2xl flex-row items-center justify-center active:bg-primary/5 active:scale-[0.98] transition-all shadow-sm"
            onPress={() => navigation.navigate("FarmPurchase")}
          >
            <MaterialIcons name="add-circle-outline" size={20} className="text-primary mr-2" />
            <Text className="text-primary font-bold text-label-lg">New Load</Text>
          </Pressable>
          <Pressable
            className="flex-1 h-14 bg-primary rounded-2xl flex-row items-center justify-center active:opacity-90 active:scale-[0.98] transition-all shadow-sm shadow-primary/30"
            onPress={() => navigation.navigate("AdminFarmsInfo")}
          >
            <MaterialIcons name="agriculture" size={20} color="white" className="mr-2" />
            <Text className="text-white font-bold text-label-lg">Farms Info</Text>
          </Pressable>
        </View>

        {/* Inventory Status */}
        <View>
          <Text className="font-title-lg text-on-surface font-bold ml-1 mb-4">Active Inventory</Text>
          
          {isInventoryLoading ? (
            <View className="py-12 items-center justify-center bg-surface-container-lowest rounded-3xl border border-outline-variant/30">
              <ActivityIndicator size="large" className="text-primary" />
              <Text className="text-on-surface-variant font-medium mt-3">Loading inventory...</Text>
            </View>
          ) : inventoryData?.items && inventoryData.items.length > 0 ? (
            <View className="flex-row flex-wrap justify-between gap-y-4">
              {inventoryData.items.map((inv) => (
                <Pressable 
                  key={inv.item_id}
                  onPress={() => navigation.navigate("AdminInventoryDetail", { itemId: inv.item_id, itemName: inv.item_name })}
                  className="w-[48%] bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm active:scale-[0.96] transition-transform flex-col relative overflow-hidden"
                >
                  <View className="absolute -right-6 -top-6 w-20 h-20 bg-primary/5 rounded-full" />
                  
                  <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mb-3">
                    <MaterialIcons name="inventory-2" size={20} className="text-primary" />
                  </View>

                  <Text className="text-on-surface-variant font-bold text-label-sm uppercase tracking-widest mb-1">
                    {inv.item_name}
                  </Text>
                  
                  <Text className="text-on-surface font-black text-headline-sm mb-4">
                    {Number(inv.total_available_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
                    <Text className="text-on-surface-variant text-label-md font-semibold"> KG</Text>
                  </Text>
                  
                  <View className="bg-primary/10 rounded-xl py-2 px-3 flex-row items-center justify-center mt-auto border border-primary/10">
                    <Text className="text-primary text-label-sm font-bold">Active Loads</Text>
                    <MaterialIcons name="arrow-forward" size={14} className="text-primary ml-1" />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : (
            <View className="bg-surface-container-lowest rounded-3xl p-8 border border-dashed border-outline-variant/50 items-center justify-center">
              <View className="w-16 h-16 bg-surface-variant/30 rounded-full items-center justify-center mb-4">
                <MaterialIcons name="inventory" size={32} className="text-on-surface-variant/70" />
              </View>
              <Text className="font-title-md text-on-surface font-bold mb-1">No Active Inventory</Text>
              <Text className="font-body-md text-on-surface-variant text-center">
                There is currently no inventory available. Receive a new farm load to update stock.
              </Text>
            </View>
          )}
        </View>

        {/* Quick Help Card */}
        <AdminCard title="About Inventory" icon="info-outline" iconColorClass="text-secondary" iconBgClass="bg-secondary/10" containerClass="mt-2">
          <Text className="text-on-surface-variant font-body-md leading-relaxed">
            Active inventory reflects the real-time stock available from farm loads that have not yet been fully allocated to delivery runs. Only items with positive stock are shown above.
          </Text>
        </AdminCard>
        
      </View>
    </AdminScreenContainer>
  );
}
