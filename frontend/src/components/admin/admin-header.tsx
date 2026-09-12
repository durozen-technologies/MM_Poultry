import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminHeader({
 title,
 subtitle,
 onBack,
 rightAction,
 rightContent,
 showBackButton = true,
}: {
 title: string;
 subtitle?: string | null;
 onBack?: () => void;
 rightAction?: React.ReactNode;
 rightContent?: React.ReactNode;
 showBackButton?: boolean;
}) {
 return (
 <View className="px-5 pt-3 pb-4 bg-white border-b border-[#e5e7eb] mb-2">
 <View className="flex-row items-center justify-between">
 <View className="flex-row items-center flex-1">
 {showBackButton && onBack && (
 <Pressable
 accessibilityRole="button"
 className="w-10 h-10 -ml-2 items-center justify-center rounded-md border border-[#e5e7eb] bg-white active:bg-gray-50 mr-3"
 onPress={onBack}
 >
 <MaterialIcons name="arrow-back" size={20} className="text-[#202124]" />
 </Pressable>
 )}
 <Text className={`text-[#111111] text-xl font-bold tracking-tight`} numberOfLines={1}>
 {title}
 </Text>
 </View>
 {(rightAction || rightContent) && (
 <View className="ml-2">
 {rightAction || rightContent}
 </View>
 )}
 </View>
 </View>
 );
}
