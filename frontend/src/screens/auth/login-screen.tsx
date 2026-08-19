import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth-store";
import { SafeAreaView } from "react-native-safe-area-context";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login(
        username.trim(),
        password,
        organizationSlug.trim() || undefined
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-surface-container-low" edges={["top", "bottom"]}>
      <View className="flex-1 w-full justify-center items-center px-4">
        <View className="flex-col items-center mb-8 w-full max-w-sm">
          <View className="w-20 h-20 mb-4 rounded-xl overflow-hidden shadow-sm bg-surface">
            <Image
              source={{
                uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpeXqD2Rxusiz7bvOAv-a3_Fibh6LWyArqIdDlUgMfpDmOKfBGpY1b0HJyK1GIWnTgiT4A-x2y99zDZyF4qlF115rMOao8-UgUBKe7HTKjdXh5XuWWiv99ng1QjMhmJ2-_p8ZGK8ywOAROpP1OHj3qAPDJVaXWukDig8bJZPI9JfI6bI3ABVjLLTFFljHf5osNESQWhfuL3cencHaASE9ElQOV-UPfn8B-eha22u88jEQT2U0m13GF",
              }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>
          <Text className="text-headline-md text-on-surface mb-1 text-center font-semibold">
            Broiler Wholesale
          </Text>
          <Text className="text-body-md text-on-surface-variant text-center">
            Admin Portal
          </Text>
        </View>

        <View className="w-full max-w-sm bg-surface rounded-xl shadow-md p-6 flex-col gap-6">
          <View className="flex-col gap-2">
            <Text className="text-label-md text-on-surface font-semibold">Username</Text>
            <View className="relative flex-row items-center bg-surface rounded-lg border border-outline-variant">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="person" size={24} className="text-on-surface" />
              </View>
              <TextInput
                className="w-full pl-10 pr-4 py-3 text-body-md text-on-surface h-12 placeholder:text-on-surface-variant"
                placeholder="e.g. admin"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
 />
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="text-label-md text-on-surface font-semibold">Password</Text>
            <View className="relative flex-row items-center bg-surface rounded-lg border border-outline-variant">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="lock" size={24} className="text-on-surface" />
              </View>
              <TextInput
                className="flex-1 pl-10 pr-12 py-3 text-body-md text-on-surface h-12 placeholder:text-on-surface-variant"
                placeholder="Enter password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
 />
              <Pressable accessibilityRole="button" accessibilityLabel="Button"
                className="absolute right-3 p-1 rounded-full z-10"
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={24}
                  className="text-on-surface"
                />
              </Pressable>
            </View>
          </View>

          <View className="flex-col gap-2">
            <Text className="text-label-md text-on-surface font-semibold">
              Organization (optional)
            </Text>
            <View className="relative flex-row items-center bg-surface rounded-lg border border-outline-variant">
              <View className="absolute left-3 z-10">
                <MaterialIcons name="business" size={24} className="text-on-surface" />
              </View>
              <TextInput
                className="w-full pl-10 pr-4 py-3 text-body-md text-on-surface h-12 placeholder:text-on-surface-variant"
                placeholder="e.g. demo"
                autoCapitalize="none"
                value={organizationSlug}
                onChangeText={setOrganizationSlug}
 />
            </View>
          </View>

          {error ? <Text className="text-error mb-3 text-center">{error}</Text> : null}

          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-full bg-primary-container h-12 rounded-lg flex-row items-center justify-center active:scale-95"
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator className="text-primary" />
            ) : (
              <Text className="text-on-primary-container font-semibold text-label-md">
                Login
              </Text>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-2">
          <MaterialIcons name="verified-user" size={16} className="text-on-surface" />
          <Text className="text-label-md text-on-surface-variant font-semibold">
            Secure B2B Portal
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
