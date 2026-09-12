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
 className="flex-1 h-14 bg-white border border-[#2E7D32]/30 rounded-lg flex-row items-center justify-center active:bg-[#2E7D32]/5 active:opacity-80 transition-opacity"
 onPress={() => navigation.navigate("FarmPurchase")}
 >
 <MaterialIcons name="add-circle-outline"size={20} className="text-[#2E7D32] mr-2"/>
 <Text className="text-[#2E7D32] text-base font-bold">New Load</Text>
 </Pressable>
 <Pressable
 className="flex-1 h-14 bg-[#2E7D32] rounded-lg flex-row items-center justify-center active:opacity-80 transition-opacity"
 onPress={() => navigation.navigate("AdminFarmsInfo")}
 >
 <MaterialIcons name="agriculture"size={20} color="white"className="mr-2"/>
 <Text className="text-white font-bold text-base font-bold">Farms Info</Text>
 </Pressable>
 </View>

 {/* Inventory Status */}
 <View>
 <Text className="text-2xl font-bold text-[#202124] ml-1 mb-4">Active Inventory</Text>
 
 {isInventoryLoading ? (
 <View className="py-12 items-center justify-center bg-white rounded-lg border border-[#e5e7eb]">
 <ActivityIndicator size="large"className="text-[#2E7D32]"/>
 <Text className="text-[#5f6368] font-medium mt-3">Loading inventory...</Text>
 </View>
 ) : inventoryData?.items && inventoryData.items.length > 0 ? (
 <View className="flex-row flex-wrap justify-between gap-y-4">
 {inventoryData.items.map((inv) => (
 <Pressable 
 key={inv.item_id}
 onPress={() => navigation.navigate("AdminInventoryDetail", { itemId: inv.item_id, itemName: inv.item_name })}
 className="w-[48%] bg-white rounded-lg p-5 border border-[#e5e7eb] active:scale-[0.96] transition-transform flex-col relative overflow-hidden"
 >
 <View className="absolute -right-6 -top-6 w-20 h-20 bg-[#2E7D32]/5 rounded-lg"/>
 
 <View className="w-10 h-10 rounded-lg bg-[#2E7D32]/10 items-center justify-center mb-3">
 <MaterialIcons name="inventory-2"size={20} className="text-[#2E7D32]"/>
 </View>

 <Text className="text-[#5f6368] text-label-sm uppercase tracking-widest mb-1">
 {inv.item_name}
 </Text>
 
 <Text className="text-[#202124] font-black text-headline-sm mb-4">
 {Number(inv.total_available_kg).toLocaleString("en-IN", { maximumFractionDigits: 3 })}
 <Text className="text-[#5f6368] text-sm font-bold font-semibold"> KG</Text>
 </Text>
 
 <View className="bg-[#2E7D32]/10 rounded-lg py-2 px-3 flex-row items-center justify-center mt-auto border border-[#2E7D32]/10">
 <Text className="text-[#2E7D32] text-label-sm">Active Loads</Text>
 <MaterialIcons name="arrow-forward"size={14} className="text-[#2E7D32] ml-1"/>
 </View>
 </Pressable>
 ))}
 </View>
 ) : (
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="inventory"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">No Active Inventory</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center">
 There is currently no inventory available. Receive a new farm load to update stock.
 </Text>
 </View>
 )}
 </View>

 {/* Quick Help Card */}
 <AdminCard title="About Inventory"icon="info-outline"iconColorClass="text-secondary"iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]"containerClass="mt-2">
 <Text className="text-[#5f6368] text-base text-[#5f6368] leading-relaxed">
 Active inventory reflects the real-time stock available from farm loads that have not yet been fully allocated to delivery runs. Only items with positive stock are shown above.
 </Text>
 </AdminCard>
 
 </View>
 </AdminScreenContainer>
 );
}
