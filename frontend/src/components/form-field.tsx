import { Text, TextInput, TextInputProps, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

interface FormFieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

export function FormField({ label, required, error, icon, className, ...props }: FormFieldProps) {
  return (
    <View className="flex-col gap-2">
      <Text className="font-label-md text-label-md text-on-surface-variant font-semibold" accessibilityRole="header">
        {label} {required && <Text className="text-error" accessibilityLabel="required">*</Text>}
      </Text>
      <View className="relative w-full">
        <TextInput
          placeholderTextColor="#737373"
          accessibilityLabel={label + (required ? ", required" : "")}
          accessibilityState={{ disabled: props.editable === false }}
          accessibilityHint={error ? error : undefined}
          className={`w-full bg-surface min-h-[48px] h-12 rounded-lg border ${
            error ? "border-error" : "border-surface-variant"
          } px-4 ${icon ? "pr-12" : ""} font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant ${className || ""}`}
          {...props}
        />
        {icon && (
          <View className="absolute right-4 top-0 bottom-0 justify-center" pointerEvents="none">
            <MaterialIcons name={icon} size={20} className="text-secondary" />
          </View>
        )}
      </View>
      {error && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" className="text-error text-label-sm font-body-sm mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}
