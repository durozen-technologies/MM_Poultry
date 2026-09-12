import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminCard({
 title,
 icon,
 iconColorClass = "text-[#111111]",
 iconBgClass = "bg-[#f7f8fa]",
 rightAction,
 children,
 containerClass = "",
}: {
 title?: string;
 icon?: keyof typeof MaterialIcons.glyphMap;
 iconColorClass?: string;
 iconBgClass?: string;
 rightAction?: React.ReactNode;
 children: React.ReactNode;
 containerClass?: string;
}) {
 return (
 <View className={`bg-white rounded-lg border border-[#e5e7eb] p-6 ${containerClass}`}>
 {(title || icon || rightAction) && (
 <View className="flex-row items-center justify-between mb-5">
 <View className="flex-row items-center flex-1 mr-2">
 {icon && (
 <View className={`w-8 h-8 rounded-md border border-[#e5e7eb] ${iconBgClass} items-center justify-center mr-3`}>
 <MaterialIcons name={icon} size={16} className={iconColorClass} />
 </View>
 )}
 {title && <Text className="text-[#111111] text-lg font-bold tracking-tight">{title}</Text>}
 </View>
 {rightAction}
 </View>
 )}
 <View className="flex-col gap-4">
 {children}
 </View>
 </View>
 );
}
