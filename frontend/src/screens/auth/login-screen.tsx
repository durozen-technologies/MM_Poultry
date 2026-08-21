import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth-store";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login(
        username.trim(),
        password
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-surface relative">
      {/* Background Architectural Header in Deep Navy Blue */}
      <View className="absolute top-0 left-0 right-0 h-[320px] bg-[#01256C] rounded-b-[48px] overflow-hidden" />

      <KeyboardAwareScrollView 
        className="flex-1 z-10"
        contentContainerStyle={{ flexGrow: 1 }} 
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
        bounces={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
          <SafeAreaView className="flex-1 justify-center items-center px-6 py-8 min-h-screen" edges={["top", "bottom"]}>
            <View className="w-full max-w-sm justify-center items-center">
              
              <Animated.View entering={FadeInDown.springify().damping(22)} className="flex-col items-center mb-10 w-full mt-8">
                <View className="w-24 h-24 mb-6 rounded-3xl overflow-hidden shadow-lg border border-white/20 bg-white items-center justify-center elevation-md">
                  <Image
                    source={require("../../../assets/logo.jpeg")}
                    className="w-full h-full"
                    resizeMode="contain"
                  />
                </View>
                <Text className="text-[32px] text-white mb-1 text-center font-bold tracking-tight">
                  Trader's Hub
                </Text>
              </Animated.View>

              <Animated.View entering={FadeInUp.delay(100).springify().damping(22)} className="w-full bg-white rounded-[32px] shadow-sm border border-black/5 elevation-md p-8 flex-col gap-6 mb-8">
                <View className="flex-col gap-2">
                  <Text className="text-label-md text-on-surface font-semibold ml-1">USERNAME</Text>
                  <View className="relative flex-row items-center bg-surface-container-low rounded-2xl border border-outline-variant/30 focus:border-[#01256C]">
                    <View className="absolute left-4 z-10">
                      <MaterialIcons name="person-outline" size={22} className="text-[#01256C]/70" />
                    </View>
                    <TextInput
                      className="w-full pl-12 pr-4 py-3 text-body-lg text-on-surface h-14 placeholder:text-on-surface-variant/50"
                      placeholder="e.g. admin"
                      autoCapitalize="none"
                      value={username}
                      onChangeText={setUsername}
                    />
                  </View>
                </View>

                <View className="flex-col gap-2">
                  <Text className="text-label-md text-on-surface font-semibold ml-1">PASSWORD</Text>
                  <View className="relative flex-row items-center bg-surface-container-low rounded-2xl border border-outline-variant/30 focus:border-[#01256C]">
                    <View className="absolute left-4 z-10">
                      <MaterialIcons name="lock-outline" size={22} className="text-[#01256C]/70" />
                    </View>
                    <TextInput
                      className="flex-1 pl-12 pr-12 py-3 text-body-lg text-on-surface h-14 placeholder:text-on-surface-variant/50"
                      placeholder="Enter password"
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable accessibilityRole="button"
                      className="absolute right-3 p-2 rounded-full z-10 active:opacity-70"
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <MaterialIcons
                        name={showPassword ? "visibility" : "visibility-off"}
                        size={22}
                        className="text-[#01256C]/70"
                      />
                    </Pressable>
                  </View>
                </View>

                {error ? (
                  <Animated.View entering={FadeInDown} className="bg-error-container p-3 rounded-xl flex-row items-center">
                    <MaterialIcons name="error-outline" size={18} className="text-on-error-container mr-2" />
                    <Text className="text-on-error-container text-body-sm flex-1">{error}</Text>
                  </Animated.View>
                ) : null}

                <Pressable accessibilityRole="button"
                  className="w-full bg-[#012E82] h-14 rounded-full flex-row items-center justify-center active:opacity-80 mt-2 shadow-sm"
                  onPress={onSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white font-bold text-label-lg tracking-wider">
                      LOGIN
                    </Text>
                  )}
                </Pressable>
              </Animated.View>

            </View>
          </SafeAreaView>
      </KeyboardAwareScrollView>
    </View>
  );
}
