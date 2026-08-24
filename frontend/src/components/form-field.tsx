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
      <Text className="font-label-md text-label-md text-on-surface-variant font-semibold">
        {label} {required && <Text className="text-error">*</Text>}
      </Text>
      <View className="relative w-full">
        <TextInput
          placeholderTextColor="#737373"
          className={`w-full bg-surface h-12 rounded-lg border ${
            error ? "border-error" : "border-surface-variant"
          } px-4 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant ${className || ""}`}
          {...props}
        />
        {icon && (
          <View className="absolute right-4 top-0 bottom-0 justify-center">
            <MaterialIcons name={icon} size={20} className="text-secondary" />
          </View>
        )}
      </View>
      {error && (
        <Text className="text-error text-label-sm font-body-sm mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}
