import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth-store";
import { getApiErrorMessage, isHttpStatus } from "../../api/client";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp, withSpring, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showOrgField, setShowOrgField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Focus states for animated borders
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isOrgFocused, setIsOrgFocused] = useState(false);

  const onSubmit = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password, orgSlug.trim() || undefined);
      setShowOrgField(false);
    } catch (e) {
      if (isHttpStatus(e, 409)) {
        // Multiple accounts with same username — need org code to disambiguate
        setShowOrgField(true);
        setError("More than one account uses this username. Enter your organisation code, then tap Login again.");
      } else {
        setError(getApiErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  }, [loading, login, username, password, orgSlug]);

  return (
    <View className="flex-1 bg-surface relative">
      {/* Background Architectural Header in Deep Green */}
      <View className="absolute top-0 left-0 right-0 h-[360px] bg-[#012D1D] rounded-b-[64px] overflow-hidden shadow-sm" />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView
          className="flex-1 z-10"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <View className="flex-1 justify-center items-center px-6 py-8" style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="w-full max-w-md justify-center items-center">
            
            <Animated.View entering={FadeInDown.springify().damping(22)} className="flex-col items-center mb-8 w-full mt-6">
              <View className="w-28 h-28 mb-5 rounded-[28px] overflow-hidden shadow-2xl border-[3px] border-white/10 bg-white items-center justify-center">
                <Image
                  source={require("../../../assets/logo.jpeg")}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>
              <Text className="text-[34px] text-white mb-2 text-center font-bold tracking-tight">
                Trader's Hub
              </Text>
              <Text className="text-[15px] text-white/70 text-center font-medium">
                Wholesale Management Portal
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(150).springify().damping(22)} className="w-full bg-white rounded-[32px] shadow-lg border border-black/5 elevation-md p-6 sm:p-8 flex-col gap-5 mb-8">
              
              {/* Username Input */}
              <View className="flex-col gap-1.5">
                <Text className="text-[13px] uppercase tracking-wider text-on-surface-variant font-bold ml-1">Username</Text>
                <View className={`relative flex-row items-center bg-surface-container-low rounded-[20px] border-2 transition-colors ${isUsernameFocused ? 'border-[#012D1D] bg-white' : 'border-transparent'}`}>
                  <View className="absolute left-4 z-10" pointerEvents="none">
                    <MaterialIcons name="person-outline" size={22} className={isUsernameFocused ? "text-[#012D1D]" : "text-[#012D1D]/50"} />
                  </View>
                  <TextInput
                    className="w-full pl-[52px] pr-4 py-3 text-[16px] text-on-surface h-14 placeholder:text-outline"
                    placeholder="e.g. admin"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    accessibilityLabel="Username"
                    returnKeyType="next"
                    value={username}
                    onChangeText={setUsername}
                    onFocus={() => setIsUsernameFocused(true)}
                    onBlur={() => setIsUsernameFocused(false)}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View className="flex-col gap-1.5">
                <Text className="text-[13px] uppercase tracking-wider text-on-surface-variant font-bold ml-1">Password</Text>
                <View className={`relative flex-row items-center bg-surface-container-low rounded-[20px] border-2 transition-colors ${isPasswordFocused ? 'border-[#012D1D] bg-white' : 'border-transparent'}`}>
                  <View className="absolute left-4 z-10" pointerEvents="none">
                    <MaterialIcons name="lock-outline" size={22} className={isPasswordFocused ? "text-[#012D1D]" : "text-[#012D1D]/50"} />
                  </View>
                  <TextInput
                    className="flex-1 pl-[52px] pr-12 py-3 text-[16px] text-on-surface h-14 placeholder:text-outline"
                    placeholder="Enter password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    accessibilityLabel="Password"
                    returnKeyType="done"
                    onSubmitEditing={onSubmit}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setIsPasswordFocused(true)}
                    onBlur={() => setIsPasswordFocused(false)}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 w-10 h-10 items-center justify-center rounded-full z-10 active:opacity-70 bg-[#012D1D]/5"
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <MaterialIcons
                      name={showPassword ? "visibility" : "visibility-off"}
                      size={20}
                      className="text-[#012D1D]/80"
                    />
                  </Pressable>
                </View>
              </View>

              {/* Org Slug Field (Conditional) */}
              {showOrgField ? (
                <Animated.View entering={FadeInDown.duration(300)} className="flex-col gap-1.5 mt-1">
                  <Text className="text-[13px] uppercase tracking-wider text-on-surface-variant font-bold ml-1">Organisation Code</Text>
                  <View className={`relative flex-row items-center bg-surface-container-low rounded-[20px] border-2 transition-colors ${isOrgFocused ? 'border-[#012D1D] bg-white' : 'border-transparent'}`}>
                    <View className="absolute left-4 z-10" pointerEvents="none">
                      <MaterialIcons name="business" size={22} className={isOrgFocused ? "text-[#012D1D]" : "text-[#012D1D]/50"} />
                    </View>
                    <TextInput
                      className="w-full pl-[52px] pr-4 py-3 text-[16px] text-on-surface h-14 placeholder:text-outline"
                      placeholder="e.g. demo"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Organisation code"
                      returnKeyType="done"
                      onSubmitEditing={onSubmit}
                      value={orgSlug}
                      onChangeText={setOrgSlug}
                      onFocus={() => setIsOrgFocused(true)}
                      onBlur={() => setIsOrgFocused(false)}
                    />
                  </View>
                  <Text className="text-[13px] text-on-surface-variant/80 ml-1 mt-0.5">Find this on your last bill or ask your wholesaler.</Text>
                </Animated.View>
              ) : null}

              {/* Error Message */}
              {error ? (
                <Animated.View entering={FadeInDown.duration(300)} accessibilityRole="alert" className="bg-error-container/80 p-4 rounded-[20px] flex-row items-center border border-error/10">
                  <MaterialIcons name="error" size={20} className="text-error mr-3" />
                  <Text className="text-error font-medium text-[14px] flex-1 leading-5">{error}</Text>
                </Animated.View>
              ) : null}

              {/* Submit Button */}
              <Pressable 
                accessibilityRole="button" 
                accessibilityLabel="Login" 
                accessibilityState={{ disabled: loading, busy: loading }}
                className={`w-full h-14 rounded-[20px] flex-row items-center justify-center mt-4 transition-all ${loading ? 'bg-[#012D1D]/70' : 'bg-[#012D1D] active:scale-[0.98]'}`}
                style={{
                  shadowColor: '#012D1D',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.25,
                  shadowRadius: 16,
                  elevation: 8,
                }}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" accessibilityLabel="Signing in" />
                ) : (
                  <Text className="text-white font-bold text-[16px] tracking-wide">
                    Sign In
                  </Text>
                )}
              </Pressable>
            </Animated.View>

          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

