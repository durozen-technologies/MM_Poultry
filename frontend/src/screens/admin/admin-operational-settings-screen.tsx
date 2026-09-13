import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { getOrgSettings, updateOrgSettings } from "../../api/settings";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

export function AdminOperationalSettingsScreen({ navigation }: { navigation: any }) {
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
          title="Operational Settings"
          subtitle="Configure rules & limits"
          onBack={() => navigation.goBack()}
        />
      }
    >
      <View className="flex-col gap-6 px-4">
        {loading ? (
          <View className="py-6 items-center justify-center">
            <ActivityIndicator size="large" className="text-[#2E7D32]" />
          </View>
        ) : error ? (
          <View className="py-4 items-center">
            <MaterialIcons name="cloud-off" size={40} className="text-[#5f6368]/40 mb-3" />
            <Text className="text-error font-medium mb-3">{error}</Text>
            <Pressable onPress={fetchSettings} className="bg-[#2E7D32]/10 px-4 py-2 rounded-lg">
              <Text className="text-[#2E7D32]">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-col gap-5">
            {msg && (
              <View className={`p-3 rounded-lg flex-row items-center ${msg.ok ? "bg-[#2E7D32]/10/80" : "bg-error-container/80"}`}>
                <MaterialIcons name={msg.ok ? "check-circle" : "error-outline"} size={20} className={`${msg.ok ? "text-on-primary-container" : "text-error"} mr-2`} />
                <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${msg.ok ? "text-on-primary-container" : "text-error"}`}>
                  {msg.text}
                </Text>
              </View>
            )}

            {/* Weight Loss Thresholds */}
            <View>
              <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368] font-semibold mb-2 ml-1 uppercase tracking-wider">Weight Loss Thresholds</Text>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Warn Limit (%)</Text>
                  <View className="relative flex-row items-center">
                    <View className="absolute left-4 z-10">
                      <MaterialIcons name="warning" size={20} className="text-[#5f6368]" />
                    </View>
                    <TextInput
                      className="h-14 bg-white border border-[#e5e7eb] rounded-lg pl-12 pr-4 text-lg text-[#202124] text-[#202124] font-medium focus:border-[#2E7D32] focus:bg-white transition-colors"
                      value={warn}
                      onChangeText={setWarn}
                      keyboardType="decimal-pad"
                      placeholder="2.00"
                      placeholderTextColor="#717973"
                    />
                  </View>
                </View>
                <View className="flex-1">
                  <Text className="text-[#5f6368] text-sm font-bold font-semibold mb-1.5 ml-1">Alert Limit (%)</Text>
                  <View className="relative flex-row items-center">
                    <View className="absolute left-4 z-10">
                      <MaterialIcons name="error-outline" size={20} className="text-[#5f6368]" />
                    </View>
                    <TextInput
                      className="h-14 bg-white border border-[#e5e7eb] rounded-lg pl-12 pr-4 text-lg text-[#202124] text-[#202124] font-medium focus:border-[#2E7D32] focus:bg-white transition-colors"
                      value={alert}
                      onChangeText={setAlert}
                      keyboardType="decimal-pad"
                      placeholder="5.00"
                      placeholderTextColor="#717973"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Credit Limit Toggle */}
            <View className="flex-row justify-between items-center bg-white p-4 rounded-lg border border-[#e5e7eb]">
              <View className="flex-1 pr-4">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <MaterialIcons name="account-balance-wallet" size={18} className="text-[#5f6368]" />
                  <Text className="text-[#202124] text-base font-bold text-[#5f6368] font-semibold">Enforce Credit Limit</Text>
                </View>
                <Text className="text-[#5f6368] text-body-sm ml-6">Prevent new sales if limit exceeded</Text>
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
              className={`h-14 rounded-lg flex-row items-center justify-center active:scale-[0.98] transition-transform ${saving ? "bg-[#2E7D32]/70" : "bg-[#2E7D32] "}`}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="white" />
                  <Text className="text-white font-bold text-base font-bold ml-2">Save Configuration</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </AdminScreenContainer>
  );
}
