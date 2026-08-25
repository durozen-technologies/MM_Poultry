import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function MetricCard({
  icon,
  label,
  value,
  valueColor = "text-on-surface",
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <View className="w-[48%] bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30">
      <View className="flex-row items-center gap-2 mb-2">
        <MaterialIcons name={icon} size={18} className="text-on-surface" />
        <Text className="font-label-md text-on-surface-variant">{label}</Text>
      </View>
      <Text className={`font-display-lg ${valueColor}`}>{value}</Text>
    </View>
  );
}
