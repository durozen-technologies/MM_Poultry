import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  variant?: "primary" | "error" | "secondary";
  className?: string;
}

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  icon,
  variant = "primary",
  className = "",
}: PrimaryButtonProps) {
  
  let bgClass = "bg-primary shadow-sm shadow-primary/30";
  let textClass = "text-white";
  let iconClass = "text-white";
  
  if (variant === "error") {
    bgClass = "bg-error/10 border border-error/30";
    textClass = "text-error";
    iconClass = "text-error";
  } else if (variant === "secondary") {
    bgClass = "bg-surface-variant/30 border border-outline-variant/30";
    textClass = "text-on-surface";
    iconClass = "text-on-surface-variant";
  }

  return (
    <Pressable
      accessibilityRole="button"
      className={`h-14 rounded-full flex-row items-center justify-center px-6 active:scale-[0.98] transition-transform ${bgClass} ${disabled ? "opacity-50" : ""} ${className}`}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : variant === "error" ? "#ba1a1a" : "#44474e"} />
      ) : (
        <View className="flex-row items-center justify-center gap-2">
          {icon && <MaterialIcons name={icon} size={20} className={iconClass} />}
          <Text className={`${textClass} font-bold text-label-lg uppercase tracking-wider`}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
