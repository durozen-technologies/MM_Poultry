import React, { useState, useMemo, useCallback } from "react";
import {
 FlatList,
 Pressable,
 Text,
 TextInput,
 View,
 ScrollView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAdminFarms } from "../../hooks/use-queries";
import type { FarmOut } from "../../types/api";
import { updateFarm } from "../../api/farms";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminFarmsInfoScreen({ navigation }: { navigation: any }) {
 const { data, isLoading, refetch } = useAdminFarms();

 const farms = data?.farms || [];
 const [openMenuFarmId, setOpenMenuFarmId] = useState<string | null>(null);
 
 const [searchQuery, setSearchQuery] = useState("");
 const [filter, setFilter] = useState<"All"| "Active"| "Inactive">("All");

 const filteredFarms = useMemo(() => {
 return farms.filter((f) => {
 if (searchQuery && !f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
 if (filter === "Active"&& !f.is_active) return false;
 if (filter === "Inactive"&& f.is_active) return false;
 return true;
 });
 }, [farms, searchQuery, filter]);

 const activeCount = useMemo(() => farms.filter(f => f.is_active).length, [farms]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Farms Info"
 subtitle="Manage your supplier farms"
 onBack={() => navigation.goBack()} 
 rightContent={
 <Pressable
 accessibilityRole="button"
 className="h-10 px-4 rounded-lg flex-row items-center justify-center bg-[#2E7D32] active:bg-[#2E7D32]/90"
 onPress={() => navigation.navigate("AddFarm")}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-1"/>
 <Text className="text-sm font-bold text-white font-bold">Add</Text>
 </Pressable>
 }
 />
 }
 >
 <FlatList
 data={filteredFarms}
 keyExtractor={(item) => item.id}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 100 }}
 showsVerticalScrollIndicator={false}
 onScroll={() => setOpenMenuFarmId(null)}
 scrollEventThrottle={16}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 ListHeaderComponent={
 <>
 <View className="flex-col gap-4 mb-6 pt-2">
 {/* Summary Cards */}
 <View className="flex-row gap-4 mb-2">
 <View className="flex-1 bg-[#2E7D32] rounded-lg p-4 relative overflow-hidden">
 <View className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-lg"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] mb-1 uppercase tracking-wider">Total Farms</Text>
 <Text className="text-3xl font-black text-white font-bold">{farms.length}</Text>
 </View>
 <View className="flex-1 bg-white rounded-lg p-4 border border-[#e5e7eb] relative overflow-hidden">
 <View className="absolute right-3 top-3 w-8 h-8 bg-[#2E7D32]/10 rounded-lg items-center justify-center">
 <MaterialIcons name="agriculture"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] mb-1 uppercase tracking-wider">Active</Text>
 <Text className="text-3xl font-black text-[#2E7D32]">{activeCount}</Text>
 </View>
 </View>

 {/* Search Box */}
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="search"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 placeholderTextColor="#717973"
 className="flex-1 h-14 pl-12 pr-4 bg-white border border-[#e5e7eb] rounded-lg text-lg text-[#202124] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Search farms..."
 value={searchQuery}
 onChangeText={setSearchQuery}
 />
 </View>

 {/* Filters */}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row overflow-visible">
 {(["All", "Active", "Inactive"] as const).map((f) => (
 <Pressable
 key={f}
 onPress={() => setFilter(f)}
 className={`h-10 px-5 rounded-lg flex items-center justify-center border mr-3 transition-colors ${
 filter === f 
 ? "bg-[#2E7D32] border-[#2E7D32]"
 : "bg-white border-[#e5e7eb]"
 }`}
 >
 <Text
 className={`text-sm font-bold text-[#5f6368] ${
 filter === f ? "text-white font-bold": "text-[#5f6368]"
 }`}
 >
 {f}
 </Text>
 </Pressable>
 ))}
 </ScrollView>
 </View>
 </>
 }
 ListEmptyComponent={
 !isLoading ? (
 <View className="flex-col items-center justify-center py-12 px-4 border border-dashed border-[#e5e7eb] rounded-lg mt-4">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="agriculture"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-2xl font-bold text-[#202124] mb-2 text-center">
 No farms found
 </Text>
 <Text className="text-base text-[#202124] text-[#5f6368] text-center max-w-[250px]">
 {searchQuery || filter !== "All"
 ? "Try adjusting your search or filters."
 : "Add a new farm to start recording farm loads."}
 </Text>
 </View>
 ) : null
 }
 ItemSeparatorComponent={ItemSeparator}
 renderItem={({ item: farm }) => (
 <FarmInfoListItem 
 farm={farm}
 isOpen={openMenuFarmId === farm.id}
 onToggleMenu={() => setOpenMenuFarmId(openMenuFarmId === farm.id ? null : farm.id)}
 onCloseMenu={() => setOpenMenuFarmId(null)}
 navigation={navigation}
 refetch={refetch}
 />
 )}
 />
 </AdminScreenContainer>
 );
}

const ItemSeparator = React.memo(() => <View className="h-4"/>);

const FarmInfoListItem = React.memo(({ 
 farm, 
 isOpen, 
 onToggleMenu, 
 onCloseMenu, 
 navigation, 
 refetch 
}: { 
 farm: FarmOut; 
 isOpen: boolean; 
 onToggleMenu: () => void; 
 onCloseMenu: () => void; 
 navigation: any; 
 refetch: () => void; 
}) => {
 return (
 <View
 className={`bg-white rounded-lg p-5 border ${farm.is_active ? 'border-[#2E7D32]/20' : 'border-[#e5e7eb]'} flex-col relative overflow-hidden`}
 style={{ zIndex: isOpen ? 50 : 0, elevation: isOpen ? 10 : 0 }}
 >
 {farm.is_active && (
 <View className="absolute top-0 left-0 w-1.5 h-full bg-[#2E7D32]"/>
 )}
 
 <View className="flex-row justify-between items-start mb-4 ml-1">
 <View className="flex-col flex-1 pr-4">
 <Text className="text-title-lg text-[#202124] tracking-tight mb-1">
 {farm.name}
 </Text>
 <View className="flex-row items-center">
 <View
 className={`w-2 h-2 rounded-lg mr-2 ${
 farm.is_active ? "bg-[#2E7D32]": "bg-outline-variant"
 }`}
 />
 <Text
 className={`text-xs font-bold uppercase tracking-wider ${
 farm.is_active ? "text-[#2E7D32]": "text-[#5f6368]"
 }`}
 >
 {farm.is_active ? "Active": "Inactive"}
 </Text>
 </View>
 </View>

 <View className="relative z-50">
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#f7f8fa] active:bg-[#f7f8fa] transition-colors"
 onPress={onToggleMenu}
 >
 <MaterialIcons name="more-vert"size={20} className="text-[#5f6368]"/>
 </Pressable>

 {isOpen && (
 <View className="absolute top-12 right-0 bg-white rounded-lg border border-[#e5e7eb] overflow-hidden w-48 z-50"style={{ elevation: 10 }}>
 <Pressable 
 className="flex-row items-center gap-3 px-4 py-3.5 active:bg-[#f7f8fa]"
 onPress={() => {
 onCloseMenu();
 navigation.navigate("AdminEditFarm", { farmId: farm.id });
 }}
 >
 <MaterialIcons name="edit"size={20} className="text-[#202124]"/>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124] font-semibold">Edit Farm</Text>
 </Pressable>
 
 <Pressable 
 className="flex-row items-center gap-3 px-4 py-3.5 active:bg-[#f7f8fa] border-t border-surface-variant/30"
 onPress={async () => {
 onCloseMenu();
 try {
 await updateFarm(farm.id, { is_active: !farm.is_active });
 refetch();
 } catch (e) {
 console.error("Failed to toggle active status", e);
 }
 }}
 >
 <MaterialIcons 
 name={farm.is_active ? "block": "check-circle-outline"} 
 size={20} 
 className={farm.is_active ? "text-error": "text-[#2E7D32]"} 
 />
 <Text className={`text-sm font-bold text-[#5f6368] font-semibold ${farm.is_active ? "text-error": "text-[#2E7D32]"}`}>
 {farm.is_active ? "Mark Inactive": "Mark Active"}
 </Text>
 </Pressable>
 </View>
 )}
 </View>
 </View>

 <View className="bg-[#f7f8fa]/30 rounded-lg p-4 ml-1 border border-[#e5e7eb]">
 <View className="flex-row items-center gap-3 mb-3">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name="call"size={16} className="text-secondary"/>
 </View>
 <Text className="text-lg text-[#202124] text-[#202124]">
 {farm.contact_phone || "No Contact"}
 </Text>
 </View>
 
 <View className="flex-row items-start gap-3">
 <View className="w-8 h-8 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center mt-0.5">
 <MaterialIcons name="location-on"size={16} className="text-tertiary"/>
 </View>
 <Text className="flex-1 text-base text-[#202124] text-[#5f6368] font-medium leading-relaxed">
 {farm.location || "No location provided"}
 </Text>
 </View>
 </View>
 </View>
 );
});
