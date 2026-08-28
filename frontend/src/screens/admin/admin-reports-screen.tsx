import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { downloadReportPdf, getReportSummary } from "../../api/reports";
import { useAuthStore } from "../../store/auth-store";
import type { ReportSummary } from "../../types/api";
import { DatePickerField } from "../../components/date-picker-field";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

type Period = "daily" | "weekly" | "monthly";

export function AdminReportsScreen({ navigation }: { navigation: any }) {
  const token = useAuthStore((s) => s.token);
  const [period, setPeriod] = useState<Period>("daily");
  const [reportDate, setReportDate] = useState(todayIstDate());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportSummary(period, toApiDate(reportDate) ?? undefined);
      setSummary(data);
      setMsg(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [period, reportDate]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  async function sharePdf() {
    if (!token) return;
    try {
      const buffer = await downloadReportPdf(period, toApiDate(reportDate) ?? undefined, token);
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      // Use global btoa if available, otherwise fallback for React Native (Hermes)
      const base64 =
        typeof globalThis.btoa === "function"
          ? globalThis.btoa(binary)
          : Buffer.from(bytes).toString("base64");
      const path = `${FileSystem.cacheDirectory}report-${period}.pdf`;
      await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: "application/pdf" });
      } else {
        setMsg("Sharing not available on this device");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to export PDF");
    }
  }

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top", "bottom"]}>
      <View className="h-16 px-4 flex-row items-center bg-surface/90 border-b border-outline-variant/20">
        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="w-11 h-11 -ml-2 items-center justify-center rounded-full" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} className="text-on-surface" />
        </Pressable>
        <Text className="font-headline-sm text-on-surface font-semibold ml-2">Reports</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {msg ? <Text className="text-error mb-3 font-semibold">{msg}</Text> : null}

        <View className="flex-row gap-2 mb-4">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <Pressable accessibilityRole="button" accessibilityLabel="Button"
              key={p}
              className={`h-10 px-4 rounded-full items-center justify-center ${period === p ? "bg-primary" : "bg-surface-container"}`}
              onPress={() => setPeriod(p)}
            >
              <Text className={`font-label-md font-semibold capitalize ${period === p ? "text-on-primary" : "text-on-surface"}`}>{p}</Text>
            </Pressable>
          ))}
        </View>

        <DatePickerField label="Report Date" value={reportDate} onChange={setReportDate} />

        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-surface-container h-10 rounded-lg items-center justify-center mt-2 mb-4" onPress={refresh}>
          <Text className="text-primary font-semibold">Refresh</Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator className="text-primary" />
        ) : summary ? (
          <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/20 flex-col gap-3">
            <Text className="font-label-md text-on-surface-variant">
              {formatIstDate(summary.period_start)} – {formatIstDate(summary.period_end)}
            </Text>
            <Stat label="Ordered" value={`${summary.total_ordered_kg} kg`} />
            <Stat label="Delivered" value={`${summary.total_delivered_kg} kg`} />
            <Stat label="Sales" value={`₹${Number(summary.total_sales_amount).toLocaleString("en-IN")}`} />
            <Stat label="Collections" value={`₹${Number(summary.total_collections).toLocaleString("en-IN")}`} />
            <Stat label="Weight Loss" value={`${summary.total_loss_kg} kg`} />
          </View>
        ) : null}

        <Pressable accessibilityRole="button" accessibilityLabel="Button" className="bg-primary h-12 rounded-xl items-center justify-center mt-4 flex-row gap-2" onPress={sharePdf}>
          <MaterialIcons name="picture-as-pdf" size={20} className="text-white" />
          <Text className="text-on-primary font-semibold">Export PDF</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-2 border-b border-surface-variant/50">
      <Text className="font-body-md text-on-surface-variant">{label}</Text>
      <Text className="font-body-md text-on-surface font-semibold">{value}</Text>
    </View>
  );
}
