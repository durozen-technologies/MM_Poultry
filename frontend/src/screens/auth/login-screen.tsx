import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../store/auth-store";

export function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("password123");
  const [org, setOrg] = useState("demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password, org.trim() || undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-brand-sand px-6 justify-center">
      <Text className="text-brand-ink text-4xl font-bold mb-2">MMbroilers</Text>
      <Text className="text-brand-leaf text-base mb-8">
        Broiler wholesale orders, delivery & ledger
      </Text>
      <Text className="text-brand-ink mb-1">Username</Text>
      <TextInput
        className="bg-white border border-brand-leaf/30 rounded-lg px-3 py-3 mb-3"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <Text className="text-brand-ink mb-1">Password</Text>
      <TextInput
        className="bg-white border border-brand-leaf/30 rounded-lg px-3 py-3 mb-3"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Text className="text-brand-ink mb-1">Organization slug (tenant users)</Text>
      <TextInput
        className="bg-white border border-brand-leaf/30 rounded-lg px-3 py-3 mb-4"
        autoCapitalize="none"
        value={org}
        onChangeText={setOrg}
        placeholder="demo"
      />
      {error ? <Text className="text-brand-clay mb-3">{error}</Text> : null}
      <Pressable
        className="bg-brand-leaf rounded-lg py-3 items-center"
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Sign in</Text>
        )}
      </Pressable>
    </View>
  );
}
