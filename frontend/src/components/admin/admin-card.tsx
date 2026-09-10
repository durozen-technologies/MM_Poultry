import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminCard({
  title,
  icon,
  iconColorClass = "text-primary",
  iconBgClass = "bg-primary/10",
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
    <View className={`bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-5 shadow-sm ${containerClass}`}>
      {(title || icon || rightAction) && (
        <View className="flex-row items-center justify-between mb-5">
          <View className="flex-row items-center flex-1 mr-2">
            {icon && (
              <View className={`w-8 h-8 rounded-full ${iconBgClass} items-center justify-center mr-3`}>
                <MaterialIcons name={icon} size={18} className={iconColorClass} />
              </View>
            )}
            {title && <Text className="text-on-surface font-title-md font-bold">{title}</Text>}
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
