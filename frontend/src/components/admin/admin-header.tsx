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
    <View className="bg-primary px-4 pt-2 pb-6 rounded-b-[32px] shadow-sm z-10 relative">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {showBackButton && onBack && (
            <Pressable
              accessibilityRole="button"
              className="w-12 h-12 -ml-2 items-center justify-center rounded-full active:bg-white/20"
              onPress={onBack}
            >
              <MaterialIcons name="arrow-back" size={26} color="white" />
            </Pressable>
          )}
          <Text className={`text-white font-headline-sm font-bold tracking-tight ${(showBackButton && onBack) ? 'ml-2' : ''}`} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {(rightAction || rightContent) && (
          <View className="ml-2">
            {rightAction || rightContent}
          </View>
        )}
      </View>
      {subtitle && (
        <Text className={`text-primary-fixed-dim text-body-sm font-medium mt-1 ${(showBackButton && onBack) ? 'ml-12' : ''}`}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}
