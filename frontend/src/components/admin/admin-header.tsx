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
    <View className="px-4 pt-2 pb-2 z-10 relative">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          {showBackButton && onBack && (
            <Pressable
              accessibilityRole="button"
              className="w-12 h-12 -ml-2 items-center justify-center rounded-full active:bg-primary/10"
              onPress={onBack}
            >
              <MaterialIcons name="arrow-back" size={26} className="text-primary" />
            </Pressable>
          )}
          <Text className={`text-primary font-headline-sm font-bold tracking-tight ${(showBackButton && onBack) ? 'ml-2' : ''}`} numberOfLines={1}>
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
