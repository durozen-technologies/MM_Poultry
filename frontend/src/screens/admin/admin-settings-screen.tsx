import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth-store";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";

type SettingsItem = {
 title: string;
 subtitle: string;
 icon: keyof typeof MaterialIcons.glyphMap;
 screen: string;
};

const ITEMS: SettingsItem[] = [
 { title: "Operational Settings", subtitle: "Configure rules & limits", icon: "tune", screen: "OperationalSettings"},
 { title: "Items", subtitle: "Manage products", icon: "category", screen: "Items"},
 { title: "Drivers", subtitle: "Manage delivery personnel", icon: "groups", screen: "DeliveryUsers"},
 { title: "Reports", subtitle: "Sales summary & PDF export", icon: "assessment", screen: "Reports"},
 { title: "Retailer Users", subtitle: "Manage portal logins", icon: "security", screen: "AdminRetailerUsers"},
];

export function AdminSettingsScreen({ navigation }: { navigation: any }) {
 const logout = useAuthStore((s) => s.logout);
 const user = useAuthStore((s) => s.user);

 return (
 <AdminScreenContainer
 header={
 <AdminHeader
 title="Settings"
 subtitle="Manage configurations and menus"
 showBackButton={false}
 />
 }
 >
 <View className="flex-col gap-6">

 {/* Organization Profile Card */}
 {user?.organization_name && (
 <View className="bg-[#2E7D32] rounded-lg p-6 overflow-hidden relative">
 <View className="absolute right-[-20px] top-[-20px] opacity-[0.08]">
 <MaterialIcons name="business"size={140} color="white"/>
 </View>
 <Text className="text-2xl font-bold text-white font-bold mb-1 mt-2">
 {user.organization_name}
 </Text>
 {user.organization_slug && (
 <Text className="text-lg text-[#5f6368] text-white font-bold/80">
 @{user.organization_slug}
 </Text>
 )}
 </View>
 )}



 {/* Administration Menus */}
 <AdminCard title="Menus & Administration"icon="apps"iconColorClass="text-secondary"iconBgClass="bg-[#f7f8fa] border border-[#e5e7eb]">
 <View className="flex-col -mt-1">
 {ITEMS.map((item, index) => (
 <View key={item.screen}>
 <Pressable
 className="py-3.5 px-3 -mx-3 flex-row items-center gap-3.5 rounded-lg active:bg-[#f7f8fa] transition-colors"
 onPress={() => navigation.navigate(item.screen)}
 >
 <View className="w-10 h-10 rounded-lg bg-[#f7f8fa] border border-[#e5e7eb] items-center justify-center">
 <MaterialIcons name={item.icon} size={20} className="text-secondary"/>
 </View>
 <View className="flex-1">
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] font-semibold">{item.title}</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] mt-0.5">{item.subtitle}</Text>
 </View>
 <MaterialIcons name="chevron-right"size={22} className="text-[#5f6368]/40"/>
 </Pressable>
 {index < ITEMS.length - 1 && <View className="h-[1px] bg-outline-variant/15 ml-[52px]"/>}
 </View>
 ))}
 </View>
 </AdminCard>

 {/* Sign Out */}
 <Pressable
 className="mb-4 bg-error-container/40 rounded-lg py-4 px-5 flex-row items-center justify-center gap-2.5 border border-error/15 active:bg-error-container/70 transition-colors"
 onPress={() => logout()}
 >
 <MaterialIcons name="logout"size={20} className="text-error"/>
 <Text className="text-base font-bold text-[#5f6368] text-error">Sign Out</Text>
 </Pressable>

 {/* App Version */}
 <View className="items-center pb-2">
 <Text className="text-[#5f6368]/40 text-base text-[#5f6368]">MM Poultry v1.0</Text>
 </View>

 </View>
 </AdminScreenContainer>
 );
}
