import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth-store";
import { getOrgSettings, updateOrgSettings } from "../../api/settings";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminCard } from "../../components/admin/admin-card";
import { AdminActionFooter } from "../../components/admin/admin-action-footer";

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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
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
      setMsg({ text: "Thresholds must be positive numbers", ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    if (w >= a) {
      setMsg({ text: "Warn must be less than Alert", ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await updateOrgSettings({ weight_loss_warn_pct: warn as any, weight_loss_alert_pct: alert as any, enforce_credit_limit: enforce });
      setMsg({ text: "Settings saved successfully", ok: true });
      setTimeout(() => setMsg(null), 3000);
    } catch (e: any) {
      const m = e?.response?.data?.error?.message || e?.response?.data?.detail || e.message || "Failed to save";
      setMsg({ text: typeof m === "string" ? m : JSON.stringify(m), ok: false });
      setTimeout(() => setMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminScreenContainer
      header={
        <AdminHeader 
          title="Settings" 
          subtitle="Manage configurations and menus"
          showBackButton={false}
        />
      }
    >
      <View className="flex-col gap-6">
        
        {/* Profile Card */}
        {user?.organization_name && (
          <View className="bg-primary rounded-3xl p-6 shadow-sm overflow-hidden relative">
            <View className="absolute right-[-20px] top-[-20px] opacity-10">
              <MaterialIcons name="business" size={120} color="white" />
            </View>
            <Text className="font-label-lg text-primary-fixed uppercase font-bold tracking-wider mb-2">
              Organization
            </Text>
            <Text className="font-display-sm text-white font-bold mb-1">
              {user.organization_name}
            </Text>
            {user.organization_slug && (
              <Text className="font-body-lg text-white/80">
                @{user.organization_slug}
              </Text>
            )}
          </View>
        )}

        {/* Operational Settings */}
        <AdminCard title="Operational Settings" icon="tune" iconColorClass="text-tertiary" iconBgClass="bg-tertiary/10">
          {loading ? (
            <View className="py-6 items-center justify-center">
              <ActivityIndicator size="large" className="text-primary" />
            </View>
          ) : error ? (
            <View className="py-4 items-center">
              <Text className="text-error font-medium mb-3">{error}</Text>
              <Pressable onPress={fetchSettings} className="bg-primary/10 px-4 py-2 rounded-xl">
                <Text className="text-primary font-bold">Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View className="flex-col gap-5">
              {msg && (
                <View className={`p-3 rounded-xl flex-row items-center ${msg.ok ? "bg-primary-container/80" : "bg-error-container/80"}`}>
                  <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container" : "text-error"} mr-2`} />
                  <Text className={`font-label-md font-semibold flex-1 ${msg.ok ? "text-on-primary-container" : "text-error"}`}>
                    {msg.text}
                  </Text>
                </View>
              )}

              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Warn Limit (%)</Text>
                  <TextInput
                    className="h-14 bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium focus:border-primary"
                    value={warn}
                    onChangeText={setWarn}
                    keyboardType="decimal-pad"
                    placeholder="2.00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-on-surface-variant text-label-md font-semibold mb-1.5 ml-1">Alert Limit (%)</Text>
                  <TextInput
                    className="h-14 bg-surface-container-lowest border border-outline-variant/50 rounded-xl px-4 text-body-lg text-on-surface font-medium focus:border-primary"
                    value={alert}
                    onChangeText={setAlert}
                    keyboardType="decimal-pad"
                    placeholder="5.00"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              <View className="flex-row justify-between items-center bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30">
                <View className="flex-1 pr-4">
                  <Text className="text-on-surface font-title-md font-semibold">Enforce Credit Limit</Text>
                  <Text className="text-on-surface-variant text-body-sm mt-0.5">Prevent new sales if limit exceeded</Text>
                </View>
                <Switch
                  value={enforce}
                  onValueChange={setEnforce}
                  trackColor={{ false: "rgba(193, 200, 194, 0.5)", true: "rgba(27, 67, 50, 0.5)" }}
                  thumbColor={enforce ? "#1B4332" : "#717973"}
                />
              </View>

              <Pressable
                onPress={onSave}
                disabled={saving}
                className={`h-13 rounded-xl flex-row items-center justify-center active:scale-[0.98] transition-transform ${saving ? "bg-primary/70" : "bg-primary shadow-sm shadow-primary/30"}`}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={20} color="white" />
                    <Text className="text-white font-bold text-label-lg ml-2">Save Configuration</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </AdminCard>

        {/* Administration Menus */}
        <View className="flex-col gap-3">
          <Text className="font-title-lg text-on-surface font-bold ml-1 mb-1">Menus & Administration</Text>
          {ITEMS.map((item) => (
            <Pressable
              key={item.screen}
              className="bg-surface-container-lowest rounded-2xl p-4 flex-row items-center gap-4 border border-outline-variant/30 active:scale-[0.98] transition-transform shadow-sm"
              onPress={() => navigation.navigate(item.screen)}
            >
              <View className="w-12 h-12 rounded-full bg-secondary/10 items-center justify-center">
                <MaterialIcons name={item.icon} size={24} className="text-secondary" />
              </View>
              <View className="flex-1">
                <Text className="font-title-md text-on-surface font-bold">{item.title}</Text>
                <Text className="font-body-md text-on-surface-variant mt-0.5">{item.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} className="text-on-surface-variant" />
            </Pressable>
          ))}
        </View>

        {/* Logout */}
        <Pressable
          className="mt-4 mb-8 bg-error-container/80 rounded-2xl p-4 flex-row items-center justify-center gap-2 border border-error/20 active:opacity-80 active:scale-[0.98] transition-all"
          onPress={() => logout()}
        >
          <MaterialIcons name="logout" size={22} className="text-error" />
          <Text className="font-title-md text-error font-bold tracking-wide">Secure Logout</Text>
        </Pressable>

      </View>
    </AdminScreenContainer>
  );
}
