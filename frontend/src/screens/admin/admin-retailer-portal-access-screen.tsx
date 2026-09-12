import React, { useState, useMemo, useCallback } from "react";
import {
 ActivityIndicator,
 FlatList,
 Pressable,
 Text,
 TextInput,
 View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { listRetailers, createRetailerPortalUser } from "../../api/retailers";
import type { Retailer } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

export function AdminRetailerPortalAccessScreen({ navigation }: { navigation: any }) {
 const [search, setSearch] = useState("");
 const [selected, setSelected] = useState<Retailer | null>(null);
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);
 const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

 const { data, isLoading } = useQuery({
 queryKey: ["admin", "retailers", "portal-list"],
 queryFn: () => listRetailers(undefined, 200),
 });

 const retailers = data?.items ?? [];
 const filtered = useMemo(() => {
 if (!search.trim()) return retailers;
 return retailers.filter((r) =>
 r.name.toLowerCase().includes(search.toLowerCase()) ||
 r.phone?.includes(search)
 );
 }, [retailers, search]);

 function selectRetailer(r: Retailer) {
 setSelected(r);
 setUsername("");
 setPassword("");
 setMessage(null);
 }

 async function createAccount() {
 if (!selected) return;
 if (!username.trim() || !password.trim()) {
 setMessage({ text: "Username and Password are required", ok: false });
 return;
 }
 setLoading(true);
 setMessage(null);
 try {
 await createRetailerPortalUser(selected.id, {
 username: username.trim(),
 password: password.trim(),
 });
 setMessage({ text: "Portal account created successfully!", ok: true });
 setUsername("");
 setPassword("");
 } catch (e: any) {
 if (e?.response?.status === 409) {
 setMessage({ text: "This retailer already has a portal account.", ok: false });
 } else {
 setMessage({ text: e instanceof Error ? e.message : "Failed to create portal account.", ok: false });
 }
 } finally {
 setLoading(false);
 }
 }

 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Portal Access"
 subtitle="Manage app login access for retailers"
 onBack={() => navigation.goBack()} 
 />
 }
 >
 <View className="flex-1 flex-col gap-4">
 {/* Step 1: pick retailer */}
 {!selected ? (
 <View className="flex-1">
 <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] font-semibold mb-4 ml-1">
 Select a retailer to manage portal access
 </Text>

 {/* Search */}
 <View className="relative flex-row items-center mb-4">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="search"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Search by name or phone..."
 placeholderTextColor="#717973"
 value={search}
 onChangeText={setSearch}
 autoCorrect={false}
 />
 </View>

 {isLoading ? (
 <View className="flex-1 items-center justify-center py-10">
 <ActivityIndicator size="large"className="text-[#2E7D32]"/>
 </View>
 ) : (
 <FlatList
 data={filtered}
 keyExtractor={(r) => r.id}
 contentContainerStyle={{ paddingBottom: 40 }}
 showsVerticalScrollIndicator={false}
 initialNumToRender={10}
 maxToRenderPerBatch={10}
 windowSize={5}
 removeClippedSubviews={true}
 renderItem={({ item }) => <RetailerListItem item={item} onSelect={selectRetailer} />}
 ListEmptyComponent={
 <View className="items-center py-10 opacity-60">
 <MaterialIcons name="search-off"size={48} className="text-[#5f6368] mb-2"/>
 <Text className="text-[#5f6368] text-center text-lg text-[#202124]">No retailers found.</Text>
 </View>
 }
 />
 )}
 </View>
 ) : (
 /* Step 2: create/manage portal for selected retailer */
 <View className="flex-col gap-6">
 {/* Selected retailer chip */}
 <Pressable
 accessibilityRole="button"
 accessibilityLabel="Change retailer"
 className="flex-row items-center gap-4 rounded-lg p-5 border border-[#2E7D32]/20 bg-[#2E7D32]/5 active:scale-[0.98] transition-transform"
 onPress={() => { setSelected(null); setMessage(null); }}
 >
 <View className="w-12 h-12 rounded-lg items-center justify-center bg-[#2E7D32]/10">
 <MaterialIcons name="store"size={24} className="text-[#2E7D32]"/>
 </View>
 <View className="flex-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">{selected.name}</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] mt-0.5">{selected.phone || "—"}</Text>
 </View>
 <View className="flex-row items-center gap-1.5 bg-[#2E7D32]/10 px-3 py-1.5 rounded-lg">
 <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32]">Change</Text>
 <MaterialIcons name="swap-horiz"size={18} className="text-[#2E7D32]"/>
 </View>
 </Pressable>

 {/* Portal access form */}
 <AdminCard title="Create / Update Portal Login"icon="security"iconColorClass="text-secondary"iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]">
 <Text className="text-base text-[#5f6368] text-[#5f6368] leading-relaxed mb-4">
 Set a username and password for this retailer to access the portal. If they already have an account, use this to create a new one.
 </Text>

 {message && (
 <View className={`p-4 rounded-lg mb-4 flex-row items-center ${message.ok ? "bg-[#2E7D32]/10/80": "bg-error-container/80"}`}>
 <MaterialIcons name={message.ok ? "check-circle": "error-outline"} size={20} className={`${message.ok ? "text-on-primary-container": "text-error"} mr-2`} />
 <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${message.ok ? "text-on-primary-container": "text-error"}`}>
 {message.text}
 </Text>
 </View>
 )}

 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Username</Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="account-circle"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Username"
 placeholderTextColor="#717973"
 autoCapitalize="none"
 autoCorrect={false}
 value={username}
 onChangeText={setUsername}
 />
 </View>
 </View>

 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Password</Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="lock"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full bg-white h-14 rounded-lg border border-[#e5e7eb] pl-12 pr-4 text-lg text-[#5f6368] text-[#202124] focus:border-[#2E7D32]"
 placeholder="Password"
 placeholderTextColor="#717973"
 secureTextEntry
 autoCapitalize="none"
 autoCorrect={false}
 value={password}
 onChangeText={setPassword}
 />
 </View>
 </View>
 </View>
 </AdminCard>

 <AdminActionFooter
 primaryLabel="Create Login Account"
 primaryIcon="vpn-key"
 onPrimaryPress={createAccount}
 isPrimaryLoading={loading}
 />
 </View>
 )}
 </View>
 </AdminScreenContainer>
 );
}

const RetailerListItem = React.memo(({ item, onSelect }: { item: Retailer; onSelect: (r: Retailer) => void }) => {
 return (
 <Pressable
 accessibilityRole="button"
 accessibilityLabel={`Select ${item.name}`}
 className="bg-white rounded-lg p-4 mb-3 flex-row items-center gap-4 border border-[#e5e7eb] active:scale-[0.98] transition-transform"
 onPress={() => onSelect(item)}
 >
 <View className="w-12 h-12 rounded-lg items-center justify-center bg-[#2E7D32]/10/30">
 <MaterialIcons name="store"size={24} className="text-[#2E7D32]"/>
 </View>
 <View className="flex-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] tracking-tight">{item.name}</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] mt-0.5">{item.phone || "—"}</Text>
 </View>
 <MaterialIcons name="chevron-right"size={24} className="text-[#5f6368]"/>
 </Pressable>
 );
});
