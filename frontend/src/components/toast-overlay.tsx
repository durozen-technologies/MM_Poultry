import React from "react";
import { View, Text, Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore } from "../store/toast-store";

export function ToastOverlay() {
  const insets = useSafeAreaInsets();
  const { visible, title, subtitle, hideToast } = useToastStore();

  if (!visible) return null;

  return (
    <View 
      className="absolute left-4 right-4 z-50 pointer-events-none" 
      style={{ top: Math.max(insets.top, 20) }}
    >
      <View className="bg-[#2E7D32] rounded-2xl p-4 flex-row items-center shadow-sm elevation-sm pointer-events-auto">
        <MaterialIcons name="check-circle" size={28} color="white" />
        <View className="flex-1 ml-3">
          <Text className="text-white font-bold text-base">{title}</Text>
          {subtitle ? (
            <Text className="text-white/90 text-sm mt-0.5">{subtitle}</Text>
          ) : null}
        </View>
        <Pressable onPress={hideToast} className="p-2 -mr-2 rounded-full active:bg-white/20">
          <MaterialIcons name="close" size={20} color="white" />
        </Pressable>
      </View>
    </View>
  );
}
