import { useCallback, useState } from "react";
import {
 ActivityIndicator,
 Text,
 TextInput,
 View,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";
import { getFarm, updateFarm } from "../../api/farms";
import type { FarmOut } from "../../types/api";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminFarmEditScreen({ route, navigation }: { route: any; navigation: any }) {
 const { farmId } = route.params;
 const queryClient = useQueryClient();
 const [farm, setFarm] = useState<FarmOut | null>(null);
 
 const [name, setName] = useState("");
 const [mobile, setMobile] = useState("");
 const [village, setVillage] = useState("");

 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(async () => {
 try {
 const data = await getFarm(farmId);
 setFarm(data);
 setName(data.name);
 setMobile(data.contact_phone || "");
 setVillage(data.location || "");
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to load farm");
 } finally {
 setLoading(false);
 }
 }, [farmId]);

 useFocusEffect(
 useCallback(() => {
 void load();
 }, [load])
 );

 async function onSave() {
 if (!name.trim()) {
 setError("Farm Name is required");
 return;
 }
 setSaving(true);
 setError(null);
 try {
 await updateFarm(farmId, {
 name: name.trim(),
 contact_phone: mobile.trim() || null,
 location: village.trim() || null,
 });
 queryClient.invalidateQueries({ queryKey: ["admin", "farms"] });
 navigation.goBack();
 } catch (e) {
 setError(e instanceof Error ? e.message : "Failed to update farm");
 setSaving(false);
 }
 }

 if (loading || !farm) {
 return (
 <View className="flex-1 bg-white items-center justify-center">
 <ActivityIndicator size="large"className="text-[#2E7D32]"/>
 </View>
 );
 }

 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Edit Farm"
 subtitle="Update farm information"
 onBack={() => navigation.goBack()} 
 />
 }
 >
 {error && (
 <View className="bg-error-container/90 px-4 py-3 rounded-lg flex-row items-center">
 <MaterialIcons name="error-outline"size={20} className="text-on-error-container mr-2"/>
 <Text className="text-on-error-container text-body-sm font-medium flex-1">{error}</Text>
 </View>
 )}

 <AdminCard title="Farm Details"icon="store">
 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Farm Name <Text className="text-error">*</Text>
 </Text>
 <TextInput 
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Enter farm name"
 placeholderTextColor="#717973"
 value={name}
 onChangeText={setName}
 />
 </View>
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Mobile Number
 </Text>
 <TextInput 
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Enter mobile number"
 placeholderTextColor="#717973"
 keyboardType="phone-pad"
 value={mobile}
 onChangeText={setMobile}
 />
 </View>

 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Location (City/Region)
 </Text>
 <TextInput 
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Enter village or city"
 placeholderTextColor="#717973"
 value={village}
 onChangeText={setVillage}
 />
 </View>
 </View>
 </AdminCard>

 <AdminActionFooter
 primaryLabel="Save Changes"
 primaryIcon="save"
 onPrimaryPress={onSave}
 isPrimaryLoading={saving}
 />
 </AdminScreenContainer>
 );
}
