import { useState } from "react";
import {
 Text,
 TextInput,
 View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../../api/client";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

export function AdminAddRetailerScreen({ navigation }: { navigation: any }) {
 const queryClient = useQueryClient();
 const [name, setName] = useState("");
 const [shopName, setShopName] = useState("");
 const [phone, setPhone] = useState("");
 const [username, setUsername] = useState("");
 const [password, setPassword] = useState("");

 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);

 async function onSubmit() {
 if (!name.trim() || !phone.trim() || !username.trim() || !password.trim()) {
 setError("Please fill all required fields (Name, Phone, Username, Password)");
 return;
 }
 const phoneDigits = phone.trim().replace(/\D/g, "");
 if (!/^\d{10,15}$/.test(phoneDigits)) {
 setError("Phone number must be 10-15 digits");
 return;
 }
 setLoading(true);
 setError(null);
 try {
 await api.post("/admin/retailers", {
 name: name.trim(),
 shop_name: shopName.trim() || null,
 phone: phone.trim() || null,
 username: username.trim(),
 password: password.trim(),
 });
 queryClient.invalidateQueries({ queryKey: ["admin", "retailers"] });
 queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
 navigation.goBack();
 } catch (e) {
 setError(getApiErrorMessage(e));
 setLoading(false);
 }
 }

 return (
 <AdminScreenContainer
 header={
 <AdminHeader 
 title="Add Retailer"
 subtitle="Onboard a new wholesale or retail customer"
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

 {/* Basic Details Card */}
 <AdminCard title="Basic Details"icon="storefront">
 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Company / Business Name <Text className="text-error">*</Text>
 </Text>
 <TextInput
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Enter Retailer/Company Name"
 placeholderTextColor="#717973"
 value={name}
 onChangeText={setName}
 />
 </View>
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Shop Name
 </Text>
 <TextInput
 className="h-14 border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="e.g. SR Chicken Center"
 placeholderTextColor="#717973"
 value={shopName}
 onChangeText={setShopName}
 />
 </View>
 </View>
 </AdminCard>

 {/* Contact Details Card */}
 <AdminCard title="Contact Details"icon="contacts"iconColorClass="text-secondary"iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]">
 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Primary Phone <Text className="text-error">*</Text>
 </Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="phone-iphone"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full h-14 border border-[#e5e7eb] rounded-lg pl-12 pr-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="10-digit primary number"
 placeholderTextColor="#717973"
 keyboardType="phone-pad"
 value={phone}
 onChangeText={setPhone}
 />
 </View>
 </View>
 </View>
 </AdminCard>

 {/* Portal Access Card */}
 <AdminCard title="Portal Access"icon="security"iconColorClass="text-error"iconBgClass="bg-error/10">
 <View className="flex-col gap-4">
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Username <Text className="text-error">*</Text>
 </Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="account-circle"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full h-14 border border-[#e5e7eb] rounded-lg pl-12 pr-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Unique login username"
 placeholderTextColor="#717973"
 autoCapitalize="none"
 autoCorrect={false}
 value={username}
 onChangeText={setUsername}
 />
 </View>
 </View>
 <View>
 <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">
 Password <Text className="text-error">*</Text>
 </Text>
 <View className="relative flex-row items-center">
 <View className="absolute left-4 z-10">
 <MaterialIcons name="lock"size={20} className="text-[#5f6368]"/>
 </View>
 <TextInput
 className="w-full h-14 border border-[#e5e7eb] rounded-lg pl-12 pr-4 text-lg text-[#202124] text-[#202124] font-medium bg-white focus:border-[#2E7D32]"
 placeholder="Secure password"
 placeholderTextColor="#717973"
 autoCapitalize="none"
 autoCorrect={false}
 secureTextEntry
 value={password}
 onChangeText={setPassword}
 />
 </View>
 </View>
 </View>
 </AdminCard>

 <AdminActionFooter
 primaryLabel="Save Retailer"
 primaryIcon="save"
 onPrimaryPress={onSubmit}
 isPrimaryLoading={loading}
 />
 </AdminScreenContainer>
 );
}
