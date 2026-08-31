import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth-store";
import { getOrgSettings, updateOrgSettings } from "../../api/settings";

type SettingsItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  screen: string;
};

const ITEMS: SettingsItem[] = [
  { title: "Items", subtitle: "Manage products", icon: "category", screen: "Items" },
  { title: "Vehicles", subtitle: "Fleet & driver details", icon: "local-shipping", screen: "Vehicles" },
  { title: "Delivery Users", subtitle: "Driver app logins", icon: "badge", screen: "DeliveryUsers" },
  { title: "Delivery Runs", subtitle: "Build runs from farm loads", icon: "route", screen: "DeliveryRuns" },
  { title: "Reports", subtitle: "Sales summary & PDF export", icon: "assessment", screen: "Reports" },
  { title: "Retailer Users", subtitle: "Manage portal logins", icon: "security", screen: "AdminRetailerUsers" },
];

export function AdminSettingsScreen({ navigation }: { navigation: any }) {
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const [warn, setWarn] = useState("2.00");
  const [alert, setAlert] = useState("5.00");
  const [enforce, setEnforce] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getOrgSettings();
      setWarn(String(s.weight_loss_warn_pct));
      setAlert(String(s.weight_loss_alert_pct));
      setEnforce(s.enforce_credit_limit);
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to load settings";
      setError(typeof m === "string" ? m : JSON.stringify(m));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void fetchSettings(); }, [fetchSettings]));

  async function onSave() {
    const w = parseFloat(warn);
    const a = parseFloat(alert);
    if (!Number.isFinite(w) || !Number.isFinite(a) || w <= 0 || a <= 0) {
      setMsg("Thresholds must be positive numbers");
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    if (w >= a) {
      setMsg("Warn must be less than Alert");
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await updateOrgSettings({ weight_loss_warn_pct: warn as any, weight_loss_alert_pct: alert as any, enforce_credit_limit: enforce });
      setMsg("Settings saved");
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to save";
      setMsg(typeof m === "string" ? m : JSON.stringify(m));
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90">
        <Text className="font-headline-sm text-headline-sm text-on-surface font-semibold">Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {user?.organization_name ? (
          <View className="bg-primary-container rounded-2xl p-4 mb-4">
            <Text className="font-label-md text-on-primary-container uppercase font-semibold">Organization</Text>
            <Text className="font-headline-sm text-on-primary font-semibold mt-1">{user.organization_name}</Text>
            {user.organization_slug ? (
              <Text className="font-body-md text-on-primary-container mt-1">@{user.organization_slug}</Text>
            ) : null}
          </View>
        ) : null}

        <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 mb-4">
          <Text className="font-semibold text-on-surface mb-3">Operational Settings</Text>
          {loading ? (
            <ActivityIndicator color="#012D1D" />
          ) : error ? (
            <View>
              <Text className="text-error text-center">{error}</Text>
              <Pressable onPress={fetchSettings} className="mt-3 bg-primary px-4 py-2 rounded-xl self-center"><Text className="text-white font-semibold">Retry</Text></Pressable>
            </View>
          ) : (
            <>
              {msg ? <Text className={`mb-3 font-semibold ${msg.includes("saved") ? "text-primary" : "text-error"}`}>{msg}</Text> : null}
              <View className="flex-col gap-3">
                <View>
                  <Text className="text-on-surface-variant mb-1">Weight Loss Warn %</Text>
                  <TextInput value={warn} onChangeText={setWarn} keyboardType="decimal-pad" className="bg-surface border border-outline-variant rounded-lg px-3 py-3 text-on-surface" placeholder="2.00" />
                </View>
                <View>
                  <Text className="text-on-surface-variant mb-1">Weight Loss Alert %</Text>
                  <TextInput value={alert} onChangeText={setAlert} keyboardType="decimal-pad" className="bg-surface border border-outline-variant rounded-lg px-3 py-3 text-on-surface" placeholder="5.00" />
                </View>
                <View className="flex-row justify-between items-center mt-2">
                  <Text className="text-on-surface font-semibold">Enforce Credit Limit</Text>
                  <Switch value={enforce} onValueChange={setEnforce} trackColor={{ false: "#e0e3e8", true: "#1B4332" }} thumbColor={enforce ? "#fff" : "#717973"} />
                </View>
                <Pressable onPress={onSave} disabled={saving} className={`mt-3 h-12 rounded-xl items-center justify-center ${saving ? "bg-primary/50" : "bg-primary"}`}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold">Save Settings</Text>}
                </Pressable>
              </View>
            </>
          )}
        </View>

        <View className="flex-col gap-3">
          {ITEMS.map((item) => (
            <Pressable
              key={item.screen}
              className="bg-surface-container-lowest rounded-2xl p-4 flex-row items-center gap-4 border border-outline-variant/20 active:bg-surface-container"
              onPress={() => navigation.navigate(item.screen)}
            >
              <View className="w-12 h-12 rounded-full bg-primary-container/20 items-center justify-center">
                <MaterialIcons name={item.icon} size={24} className="text-primary" />
              </View>
              <View className="flex-1">
                <Text className="font-headline-sm text-on-surface font-semibold">{item.title}</Text>
                <Text className="font-body-md text-on-surface-variant mt-0.5">{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
            </Pressable>
          ))}
        </View>

        <Pressable
          className="mt-6 bg-error-container rounded-2xl p-4 flex-row items-center justify-center gap-2 active:opacity-80"
          onPress={() => logout()}
        >
          <MaterialIcons name="logout" size={20} className="text-error" />
          <Text className="font-label-md text-on-error-container font-semibold">Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
