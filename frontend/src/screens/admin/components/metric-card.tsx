import { View, Text, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function MetricCard({
 icon,
 label,
 value,
 valueColor = "text-[#111111]",
 onPress,
}: {
 icon: keyof typeof MaterialIcons.glyphMap;
 label: string;
 value: string | number;
 valueColor?: string;
 onPress?: () => void;
}) {
 const Inner = (
 <>
 <View className="flex-row items-center justify-between mb-3">
 <Text className="font-mono text-[11px] uppercase tracking-[2px] text-[#5f6368] flex-1" numberOfLines={1}>{label}</Text>
 <MaterialIcons name={icon} size={14} className="text-[#a0a5ab]" />
 </View>
 <Text className={`font-mono text-2xl font-bold ${valueColor}`} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
 </>
 );

 if (onPress) {
 return (
 <Pressable 
 onPress={onPress}
 className="w-[48%] shrink-0 bg-white rounded-lg p-5 border border-[#e5e7eb] active:bg-[#f7f8fa]"
 >
 {Inner}
 </Pressable>
 );
 }

 return (
 <View className="w-[48%] shrink-0 bg-white rounded-lg p-5 border border-[#e5e7eb]">
 {Inner}
 </View>
 );
}
