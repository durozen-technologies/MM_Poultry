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
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      // organizationSlug is implicitly 'demo' if not provided for now, or we can leave it undefined so it defaults to public auth_index lookup
      await login(username.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low" edges={["top", "bottom"]}>
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
                <MaterialIcons name="person" size={24} color="#414844" />
              </View>
              <TextInput
                className="w-full pl-10 pr-4 py-3 text-body-md text-on-surface h-12"
                placeholder="Enter username"
                placeholderTextColor="#717973"
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
                <MaterialIcons name="lock" size={24} color="#414844" />
              </View>
              <TextInput
                className="flex-1 pl-10 pr-12 py-3 text-body-md text-on-surface h-12"
                placeholder="Enter password"
                placeholderTextColor="#717973"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable
                className="absolute right-3 p-1 rounded-full z-10"
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={24}
                  color="#414844"
                />
              </Pressable>
            </View>
          </View>

          {error ? <Text className="text-error mb-3 text-center">{error}</Text> : null}

          <Pressable
            className="w-full bg-primary-container h-12 rounded-lg flex-row items-center justify-center active:scale-95"
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#86af99" />
            ) : (
              <Text className="text-on-primary-container font-semibold text-label-md">
                Login
              </Text>
            )}
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-center gap-2">
          <MaterialIcons name="verified-user" size={16} color="#414844" />
          <Text className="text-label-md text-on-surface-variant font-semibold">
            Secure B2B Portal
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
