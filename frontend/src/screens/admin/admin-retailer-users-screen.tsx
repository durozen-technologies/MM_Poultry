import React, { useCallback, useState, useMemo } from "react";
import { FlatList, ActivityIndicator, Pressable, Text, TextInput, View, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { deleteRetailerUser, listRetailerUsers, updateRetailerUser } from "../../api/users";
import { getApiErrorMessage } from "../../api/client";
import type { User } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminRetailerUsersScreen({ navigation }: { navigation: any }) {
 const queryClient = useQueryClient();
 const [users, setUsers] = useState<User[]>([]);
 const [loading, setLoading] = useState(false);
 const [refreshing, setRefreshing] = useState(false);
 const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
 const [searchQuery, setSearchQuery] = useState("");

 const refresh = useCallback(async () => {
 setLoading(true);
 try {
 setUsers(await listRetailerUsers());
 } catch (e) {
 setMsg({ text: getApiErrorMessage(e), ok: false });
 } finally {
 setLoading(false);
 }
 }, []);

 const onRefresh = useCallback(async () => {
 setRefreshing(true);
 try {
 setUsers(await listRetailerUsers());
 } catch (e) {
 setMsg({ text: getApiErrorMessage(e), ok: false });
 } finally {
 setRefreshing(false);
 }
 }, []);

 useFocusEffect(
 useCallback(() => {
 void refresh();
 }, [refresh])
 );

 async function onToggleStatus(user: User) {
 try {
 await updateRetailerUser(user.id, { is_active: !user.is_active });
 queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
 setMsg({ text: `User ${user.username} ${!user.is_active ? 'activated' : 'deactivated'}`, ok: true });
 setTimeout(() => setMsg(null), 3000);
 await refresh();
 } catch (e) {
 setMsg({ text: getApiErrorMessage(e), ok: false });
 }
 }

 async function onRemove(user: User) {
 try {
 await deleteRetailerUser(user.id);
 queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
 setMsg({ text: `User ${user.username} removed`, ok: true });
 setTimeout(() => setMsg(null), 3000);
 await refresh();
 } catch (e) {
 setMsg({ text: getApiErrorMessage(e), ok: false });
 }
 }

 const filteredUsers = useMemo(() => {
 return users.filter((u) => {
 if (searchQuery) {
 const search = searchQuery.toLowerCase();
 return (
 u.username.toLowerCase().includes(search) || 
 (u.retailer_shop_name && u.retailer_shop_name.toLowerCase().includes(search)) ||
 (u.retailer_name && u.retailer_name.toLowerCase().includes(search))
 );
 }
 return true;
 });
 }, [users, searchQuery]);

 const activeUsers = useMemo(() => users.filter(u => u.is_active).length, [users]);

 return (
 <AdminScreenContainer
 noScroll
 header={
 <AdminHeader 
 title="Retailer Users"
 subtitle="Manage app access for retailers"
 onBack={() => navigation.goBack()} 
 rightContent={
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 onPress={refresh}
 >
 {loading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={22} className="text-[#202124]"/>
 )}
 </Pressable>
 }
 />
 }
 >
 <FlatList
 data={filteredUsers}
 keyExtractor={(u) => u.id}
 className="flex-1 px-4"
 contentContainerStyle={{ paddingBottom: 40 }}
 showsVerticalScrollIndicator={false}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#012d1d"]} />}
 ListHeaderComponent={
 <>
 <View className="pt-2">
 {msg && (
 <View className={`p-4 rounded-lg mb-4 flex-row items-center ${msg.ok ? "bg-[#2E7D32]/10/80": "bg-error-container/80"}`}>
 <MaterialIcons name={msg.ok ? "check-circle": "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container": "text-error"} mr-2`} />
 <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${msg.ok ? "text-on-primary-container": "text-error"}`}>
 {msg.text}
 </Text>
 </View>
 )}

 {users.length > 0 && (
 <View className="flex-col gap-4 mb-6">
 {/* KPI Banner */}
 <View className="bg-[#2E7D32]/10 rounded-lg p-4 border border-[#2E7D32]/20 flex-row items-center justify-between">
 <View className="flex-row items-center gap-3">
 <View className="w-10 h-10 rounded-lg bg-[#2E7D32]/20 items-center justify-center">
 <MaterialIcons name="storefront"size={20} className="text-[#2E7D32]"/>
 </View>
 <View>
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32] tracking-wider uppercase mb-0.5">Active Portals</Text>
 <View className="flex-row items-end gap-1">
 <Text className="text-2xl font-bold text-[#2E7D32] font-black leading-tight">{activeUsers}</Text>
 <Text className="text-base text-[#5f6368] text-[#2E7D32]/80 mb-0.5">/ {users.length}</Text>
 </View>
 </View>
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
 placeholder="Search users or retailers..."
 value={searchQuery}
 onChangeText={setSearchQuery}
 autoCapitalize="none"
 />
 {searchQuery.length > 0 && (
 <Pressable 
 className="absolute right-4 p-1 z-10"
 onPress={() => setSearchQuery("")}
 >
 <MaterialIcons name="close"size={16} className="text-[#5f6368]"/>
 </Pressable>
 )}
 </View>
 </View>
 )}

 <View className="flex-row items-center justify-between ml-1 mb-3">
 <Text className="text-2xl font-bold text-[#202124]">User Directory</Text>
 {users.length > 0 && (
 <View className="bg-[#f7f8fa] px-3 py-1 rounded-lg">
 <Text className="text-xs font-bold text-[#5f6368]">{filteredUsers.length} Users</Text>
 </View>
 )}
 </View>
 </View>
 </>
 }
 ListEmptyComponent={
 loading && users.length === 0 ? (
 <View className="py-12 items-center">
 <ActivityIndicator size="large"className="text-[#2E7D32] mb-4"/>
 <Text className="text-[#5f6368] font-medium">Loading users...</Text>
 </View>
 ) : (
 <View className="bg-white rounded-lg p-8 border border-dashed border-[#e5e7eb] items-center justify-center mb-6 mt-2">
 <View className="w-16 h-16 bg-[#f7f8fa] rounded-lg items-center justify-center mb-4">
 <MaterialIcons name="person-off"size={32} className="text-[#5f6368]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-1">
 {searchQuery ? "No matching users": "No Retailer Users"}
 </Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center">
 {searchQuery 
 ? "Try a different search term"
 : "Retailer portal accounts are created when you add a new retailer to the system."}
 </Text>
 </View>
 )
 }
 ItemSeparatorComponent={ItemSeparator}
 renderItem={({ item: u }) => <RetailerUserCard user={u} onToggleStatus={onToggleStatus} onRemove={onRemove} />}
 />
 </AdminScreenContainer>
 );
}

const ItemSeparator = React.memo(() => <View className="h-3"/>);

const RetailerUserCard = React.memo(({ user, onToggleStatus, onRemove }: { user: User; onToggleStatus: (u: User) => void; onRemove: (u: User) => void }) => {
 const queryClient = useQueryClient();
 const [isEditing, setIsEditing] = useState(false);
 const [newPassword, setNewPassword] = useState("");
 const [showPassword, setShowPassword] = useState(false);
 const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
 const [isUpdating, setIsUpdating] = useState(false);

 async function onUpdatePassword() {
 if (!newPassword.trim()) return;
 setIsUpdating(true);
 setMsg(null);
 try {
 await updateRetailerUser(user.id, { password: newPassword });
 queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
 setNewPassword("");
 setIsEditing(false);
 setMsg({ text: "Password updated successfully", ok: true });
 setTimeout(() => setMsg(null), 3000);
 } catch (e) {
 setMsg({ text: getApiErrorMessage(e), ok: false });
 setTimeout(() => setMsg(null), 4000);
 } finally {
 setIsUpdating(false);
 }
 }

 return (
 <View className="bg-white rounded-lg border border-[#e5e7eb] relative overflow-hidden">
 {/* Left border status indicator */}
 <View className={`absolute top-0 left-0 w-1.5 h-full z-10 ${user.is_active ? 'bg-[#2E7D32]' : 'bg-[#f7f8fa]'}`} />

 <View className="p-4 pl-5">
 <View className="flex-row justify-between items-start mb-3">
 <View className="flex-1 pr-2">
 <View className="flex-row items-center gap-2 mb-1">
 <Text className="text-2xl font-bold text-[#202124]">{user.username}</Text>
 <View className={`px-2 py-0.5 rounded-lg border ${
 user.is_active ? "bg-[#2E7D32]/10 border-[#2E7D32]/20": "bg-[#f7f8fa] border-[#e5e7eb]"
 }`}>
 <Text className={`text-xs font-bold uppercase tracking-widest ${
 user.is_active ? "text-[#2E7D32]": "text-[#5f6368]"
 }`}>
 {user.is_active ? "Active": "Inactive"}
 </Text>
 </View>
 </View>
 
 <View className="flex-row items-center mt-1">
 <MaterialIcons name="storefront"size={14} className="text-[#5f6368] mr-1.5"/>
 <Text className="text-base text-[#5f6368] text-[#5f6368] font-medium">
 {user.retailer_shop_name || user.retailer_name || "Unknown Retailer"}
 </Text>
 </View>
 </View>
 
 <View className="flex-row gap-2">
 <Pressable 
 accessibilityRole="button"
 onPress={() => setIsEditing(!isEditing)} 
 className={`w-9 h-9 rounded-lg items-center justify-center transition-colors ${
 isEditing ? "bg-[#2E7D32] text-white font-bold": "bg-[#f7f8fa] active:bg-[#f7f8fa]"
 }`}
 >
 <MaterialIcons name="vpn-key"size={18} color={isEditing ? "white": undefined} className={isEditing ? "": "text-[#202124]"} />
 </Pressable>
 <Pressable 
 accessibilityRole="button"
 onPress={() => onToggleStatus(user)} 
 className={`w-9 h-9 rounded-lg items-center justify-center border ${
 user.is_active ? "bg-error/5 border-error/20 active:bg-error/10": "bg-[#2E7D32]/5 border-[#2E7D32]/20 active:bg-[#2E7D32]/10"
 }`}
 >
 <MaterialIcons name={user.is_active ? "block": "check-circle"} size={18} className={user.is_active ? "text-error": "text-[#2E7D32]"} />
 </Pressable>
 </View>
 </View>

 {msg && (
 <View className={`mb-3 p-2 rounded-voltagent-sm flex-row items-center ${msg.ok ? "bg-[#2E7D32]/10": "bg-error/10"}`}>
 <MaterialIcons name={msg.ok ? "check-circle": "error-outline"} size={14} className={`${msg.ok ? "text-[#2E7D32]": "text-error"} mr-1.5`} />
 <Text className={`text-xs font-bold flex-1 ${msg.ok ? "text-[#2E7D32]": "text-error"}`}>
 {msg.text}
 </Text>
 </View>
 )}

 {isEditing && (
 <View className="mt-2 pt-3 border-t border-[#e5e7eb] flex-col gap-3">
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">Reset Password</Text>
 <View className="flex-row gap-2 items-center">
 <View className="flex-1 flex-row items-center bg-[#f7f8fa] h-12 rounded-lg border border-[#e5e7eb] px-3 focus:border-[#2E7D32]">
 <TextInput
 className="flex-1 text-[#202124] text-lg text-[#5f6368] h-full placeholder:text-[#5f6368] pr-2"
 placeholder="New password"
 secureTextEntry={!showPassword}
 value={newPassword}
 onChangeText={setNewPassword}
 autoCapitalize="none"
 autoFocus
 />
 <Pressable accessibilityRole="button"onPress={() => setShowPassword(!showPassword)} className="p-2 -mr-2 active:opacity-70">
 <MaterialCommunityIcons name={showPassword ? "eye-off-outline": "eye-outline"} size={20} className="text-[#5f6368]"/>
 </Pressable>
 </View>
 <Pressable 
 accessibilityRole="button"
 onPress={onUpdatePassword} 
 disabled={isUpdating || !newPassword.trim()}
 className={`h-12 w-12 rounded-lg items-center justify-center active:scale-95 transition-transform ${
 !newPassword.trim() ? "bg-[#f7f8fa]": "bg-[#2E7D32] "
 }`}
 >
 {isUpdating ? (
 <ActivityIndicator size="small"color="#ffffff"/>
 ) : (
 <MaterialIcons name="check"size={22} color={!newPassword.trim() ? "#717973": "white"} />
 )}
 </Pressable>
 </View>
 </View>
 )}
 </View>
 </View>
 );
});
