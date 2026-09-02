import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

export function AdminActionFooter({
  primaryLabel,
  primaryIcon = "check-circle",
  onPrimaryPress,
  isPrimaryLoading = false,
  isPrimaryDisabled = false,
  leftContent,
  rightContent,
}: {
  primaryLabel: string;
  primaryIcon?: keyof typeof MaterialIcons.glyphMap;
  onPrimaryPress: () => void;
  isPrimaryLoading?: boolean;
  isPrimaryDisabled?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}) {
  return (
    <View className="bg-surface-container-highest rounded-3xl p-5 mb-8 border border-outline-variant/20 shadow-md mt-4">
      {(leftContent || rightContent) && (
        <View className="flex-row justify-between items-end mb-6">
          <View className="flex-1 pr-2">{leftContent}</View>
          <View className="items-end">{rightContent}</View>
        </View>
      )}

      <Pressable
        className={`w-full bg-primary h-14 rounded-full flex items-center justify-center transition-all shadow-lg shadow-primary/30 ${
          isPrimaryDisabled ? 'opacity-50' : 'active:opacity-80 active:scale-95'
        }`}
        onPress={onPrimaryPress}
        disabled={isPrimaryDisabled || isPrimaryLoading}
      >
        {isPrimaryLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <View className="flex-row items-center gap-2">
            <MaterialIcons name={primaryIcon} size={22} color="white" />
            <Text className="text-white font-bold text-title-md tracking-wide">
              {primaryLabel}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
