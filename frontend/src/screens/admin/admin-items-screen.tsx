import React, { useState, useMemo, useCallback } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, TextInput, Switch } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiItems } from "../../api/items";
import type { Item } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

export function AdminItemsScreen({ navigation }: { navigation: any }) {
 const queryClient = useQueryClient();
 const [editingItem, setEditingItem] = useState<Item | null>(null);
 const [isAdding, setIsAdding] = useState(false);
 
 const [name, setName] = useState("");
 const [description, setDescription] = useState("");
 const [isActive, setIsActive] = useState(true);

 const { data: page, isLoading, refetch, isRefetching } = useQuery({
 queryKey: ["admin_items"],
 queryFn: () => apiItems.list(),
 });

 const createMutation = useMutation({
 mutationFn: apiItems.create,
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["admin_items"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
 resetForm();
 },
 });

 const updateMutation = useMutation({
 mutationFn: ({ id, ...payload }: any) => apiItems.update(id, payload),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["admin_items"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
 resetForm();
 },
 });

 const resetForm = () => {
 setEditingItem(null);
 setIsAdding(false);
 setName("");
 setDescription("");
 setIsActive(true);
 };

 const handleEdit = (item: Item) => {
 setEditingItem(item);
 setName(item.name);
 setDescription(item.description || "");
 setIsActive(item.is_active);
 setIsAdding(false);
 };

 const handleSave = () => {
 const trimmedName = name.trim();
 const trimmedDescription = description.trim();
 if (!trimmedName) return;
 if (editingItem) {
 updateMutation.mutate({
 id: editingItem.id,
 name: trimmedName,
 description: trimmedDescription || null,
 is_active: isActive,
 });
 } else {
 createMutation.mutate({
 name: trimmedName,
 description: trimmedDescription || undefined,
 });
 }
 };

 const items = useMemo(() => page?.items || [], [page?.items]);
 const activeCount = useMemo(() => items.filter((i: Item) => i.is_active).length, [items]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Product Items"
 subtitle="Manage inventory item categories"
 onBack={() => navigation.goBack()} 
 rightContent={
 <View className="flex-row gap-2">
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 onPress={() => refetch()}
 >
 {isRefetching ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={22} className="text-[#202124]"/>
 )}
 </Pressable>
 {!isAdding && !editingItem && (
 <Pressable
 accessibilityRole="button"
 className="h-10 px-4 rounded-lg flex-row items-center justify-center bg-[#2E7D32] active:bg-[#2E7D32]/90"
 onPress={() => setIsAdding(true)}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-1.5"/>
 <Text className="text-sm font-bold text-white font-bold">Add</Text>
 </Pressable>
 )}
 </View>
 }
 />
 }
 >
 <FlatList
 data={items}
 contentContainerStyle={{ paddingBottom: 40 }}
 keyExtractor={(item) => item.id}
 refreshing={isLoading}
 onRefresh={refetch}
 className="flex-1 px-4"
 showsVerticalScrollIndicator={false}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 ListHeaderComponent={
 <>
 <View className="pt-2">
 {/* Form Card */}
 {(isAdding || editingItem) && (
 <View className="mb-6">
 <AdminCard 
 title={editingItem ? "Edit Item": "New Item"} 
 icon={editingItem ? "edit": "add-circle"} 
 iconColorClass="text-secondary"
 iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]"
 rightAction={
 <Pressable 
 accessibilityRole="button"
 className="w-8 h-8 rounded-lg bg-[#f7f8fa] items-center justify-center active:bg-[#f7f8fa]"
 onPress={resetForm}
 >
 <MaterialIcons name="close"size={18} className="text-[#5f6368]"/>
 </Pressable>
 }
 >
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Item Name <Text className="text-error">*</Text></Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="inventory"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput 
 className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
 placeholder="e.g. Broiler Chicken"
 value={name} 
 onChangeText={setName} 
 placeholderTextColor="#717973"
 />
 </View>
 </View>
 
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Description (Optional)</Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="description"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput 
 className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Brief description of the item"
 value={description} 
 onChangeText={setDescription} 
 placeholderTextColor="#717973"
 />
 </View>
 </View>

 {editingItem && (
 <View className="flex-row items-center justify-between p-3 bg-[#f7f8fa]/30 rounded-lg border border-[#e5e7eb]">
 <View className="flex-row items-center gap-2">
 <MaterialIcons name={isActive ? "check-circle": "cancel"} size={20} className={isActive ? "text-[#2E7D32]": "text-[#5f6368]"} />
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">Active Status</Text>
 </View>
 <Switch 
 value={isActive} 
 onValueChange={setIsActive} 
 trackColor={{ false: "#e0e3e8", true: "#115E29"}} 
 thumbColor={isActive ? "#ffffff": "#717973"} 
 />
 </View>
 )}

 <Pressable 
 className={`h-14 mt-2 rounded-lg flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
 !name.trim() ? "bg-[#f7f8fa]": "bg-[#2E7D32] "
 }`}
 onPress={handleSave}
 disabled={createMutation.isPending || updateMutation.isPending || !name.trim()}
 >
 {createMutation.isPending || updateMutation.isPending ? (
 <ActivityIndicator color="#ffffff"/>
 ) : (
 <>
 <MaterialIcons name={editingItem ? "save": "add-circle"} size={18} color={!name.trim() ? "#717973": "white"} />
 <Text className={` text-base font-bold ${!name.trim() ? "text-[#5f6368]": "text-white font-bold"}`}>
 {editingItem ? "Save Changes": "Create Item"}
 </Text>
 </>
 )}
 </Pressable>
 </AdminCard>
 </View>
 )}

 {/* KPI Banner */}
 {!isAdding && !editingItem && items.length > 0 && (
 <View className="bg-[#2E7D32]/10 rounded-lg p-4 border border-[#2E7D32]/20 flex-row items-center justify-between mb-6">
 <View className="flex-row items-center gap-3">
 <View className="w-10 h-10 rounded-lg bg-[#2E7D32]/20 items-center justify-center">
 <MaterialIcons name="category"size={20} className="text-[#2E7D32]"/>
 </View>
 <View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] tracking-wider uppercase mb-0.5">Active Items</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-2xl font-bold text-[#2E7D32] font-black leading-tight">{activeCount}</Text>
 <Text className="text-base text-[#5f6368] text-[#2E7D32]/80 mb-0.5">/ {items.length}</Text>
 </View>
 </View>
 </View>
 </View>
 )}

 {/* List Header */}
 <View className="flex-row items-center justify-between ml-1 mb-3">
 <Text className="text-2xl font-bold text-[#202124]">All Items</Text>
 </View>

 </View>
 </>
 }
 ListEmptyComponent={
 isLoading ? (
 <View className="py-12 items-center">
 <ActivityIndicator size="large"className="text-[#2E7D32] mb-4"/>
 <Text className="text-[#5f6368] font-medium">Loading items...</Text>
 </View>
 ) : (
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mb-6 mt-2">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="inventory-2"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">No Items Found</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center mb-6">
 You haven't defined any product items yet. Create your first item to start managing inventory.
 </Text>
 {!isAdding && !editingItem && (
 <Pressable
 className="bg-[#2E7D32] px-6 py-3 rounded-lg flex-row items-center"
 onPress={() => setIsAdding(true)}
 >
 <MaterialIcons name="add"size={20} color="white"className="mr-2"/>
 <Text className="text-white font-bold">Add First Item</Text>
 </Pressable>
 )}
 </View>
 )
 }
 ItemSeparatorComponent={ItemSeparator}
 renderItem={({ item }) => <ItemListItem item={item} onEdit={handleEdit} />}
 />
 </AdminScreenContainer>
 );
}

const ItemSeparator = React.memo(() => <View className="h-3"/>);

const ItemListItem = React.memo(({ item, onEdit }: { item: Item; onEdit: (item: Item) => void }) => {
 return (
 <View className="bg-white rounded-lg border border-[#e5e7eb] flex-row justify-between items-center relative overflow-hidden">
 <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${item.is_active ? 'bg-[#2E7D32]' : 'bg-[#f7f8fa]'}`} />
 
 <View className="p-4 pl-5 flex-1 flex-row items-center gap-4">
 <View className={`w-12 h-12 rounded-lg items-center justify-center ${item.is_active ? 'bg-[#2E7D32]/10' : 'bg-[#f7f8fa]'}`}>
 <MaterialIcons name="inventory"size={24} className={item.is_active ? 'text-[#2E7D32]' : 'text-[#5f6368]'} />
 </View>
 
 <View className="flex-1 pr-2">
 <View className="flex-row items-center gap-2 mb-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">{item.name}</Text>
 {!item.is_active && (
 <View className="bg-[#f7f8fa] px-2 py-0.5 rounded-lg">
 <Text className="text-[#5f6368] text-[10px] uppercase tracking-wider">Inactive</Text>
 </View>
 )}
 </View>
 {item.description ? (
 <Text className="text-base text-[#5f6368] text-[#5f6368] truncate"numberOfLines={1}>
 {item.description}
 </Text>
 ) : (
 <Text className="text-sm text-[#5f6368] text-[#5f6368]/50 italic">No description</Text>
 )}
 </View>
 </View>

 <Pressable 
 accessibilityRole="button"
 onPress={() => onEdit(item)} 
 className="w-12 h-12 rounded-lg items-center justify-center mr-2 active:bg-[#f7f8fa] transition-colors"
 >
 <MaterialIcons name="edit"size={20} className="text-[#5f6368]"/>
 </Pressable>
 </View>
 );
});
