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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { downloadReportPdf, getReportSummary } from "../../api/reports";
import type { ReportSummary } from "../../types/api";
import { DatePickerField } from "../../components/date-picker-field";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

import { AdminScreenContainer } from "../../components/admin/admin-screen-container";
import { AdminHeader } from "../../components/admin/admin-header";

type Period = "daily" | "weekly" | "monthly";

export function AdminReportsScreen({ navigation }: { navigation: any }) {
  const [period, setPeriod] = useState<Period>("daily");
  const [reportDate, setReportDate] = useState(todayIstDate());
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReportSummary(period, toApiDate(reportDate) ?? undefined);
      setSummary(data);
      setMsg(null);
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to load report", type: 'error' });
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
    setIsExporting(true);
    try {
      const buffer = await downloadReportPdf(period, toApiDate(reportDate) ?? undefined);
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
        setMsg({ text: "Report exported successfully", type: 'success' });
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg({ text: "Sharing not available on this device", type: 'error' });
      }
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "Failed to export PDF", type: 'error' });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <AdminScreenContainer
      noScroll
      header={
        <AdminHeader 
          title="Business Reports" 
          subtitle="View sales, collections, and delivery summaries"
          onBack={() => navigation.goBack()} 
          rightContent={
            <Pressable
              accessibilityRole="button"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-container-highest active:bg-surface-variant"
              onPress={refresh}
            >
              {loading ? (
                <ActivityIndicator size="small" className="text-primary" />
              ) : (
                <MaterialIcons name="refresh" size={22} className="text-on-surface" />
              )}
            </Pressable>
          }
        />
      }
    >
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        
        {msg && (
          <View className={`p-4 rounded-xl mb-4 flex-row items-center border ${
            msg.type === 'success' 
              ? 'bg-primary-container/30 border-primary/20' 
              : 'bg-error-container/30 border-error/20'
          }`}>
            <MaterialIcons 
              name={msg.type === 'success' ? "check-circle" : "error-outline"} 
              size={20} 
              className={msg.type === 'success' ? "text-primary mr-2" : "text-error mr-2"} 
            />
            <Text className={`font-label-md font-semibold flex-1 ${
              msg.type === 'success' ? 'text-primary' : 'text-error'
            }`}>
              {msg.text}
            </Text>
          </View>
        )}

        {/* Configuration Card */}
        <View className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl p-5 mb-6 shadow-sm">
          <View className="flex-row items-center gap-2 mb-4">
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
              <MaterialIcons name="tune" size={16} className="text-primary" />
            </View>
            <Text className="font-title-md font-bold text-on-surface">Report Settings</Text>
          </View>

          <Text className="font-label-md font-semibold text-on-surface-variant uppercase tracking-wider mb-2 ml-1">Period</Text>
          <View className="flex-row bg-surface-container-highest rounded-xl p-1 mb-5 border border-outline-variant/20">
            {(["daily", "weekly", "monthly"] as const).map((p) => (
              <Pressable
                accessibilityRole="button"
                key={p}
                className={`flex-1 py-2.5 rounded-lg items-center transition-colors ${
                  period === p ? "bg-primary shadow-sm" : ""
                }`}
                onPress={() => setPeriod(p)}
              >
                <Text className={`font-label-md font-bold capitalize ${
                  period === p ? "text-white" : "text-on-surface-variant"
                }`}>
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="font-label-md font-semibold text-on-surface-variant uppercase tracking-wider mb-2 ml-1">Reference Date</Text>
          <View className="mb-2">
            <DatePickerField 
              label="" 
              value={reportDate} 
              onChange={setReportDate} 
              inputStyle="h-13 bg-surface border border-outline-variant/50 rounded-xl px-4 text-body-lg"
            />
          </View>
        </View>

        {/* Results */}
        <View className="flex-row items-center justify-between mb-4 ml-1">
          <Text className="font-title-lg text-on-surface font-bold">Summary Data</Text>
          {summary && (
            <View className="bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
              <Text className="font-label-sm text-primary font-bold">Generated</Text>
            </View>
          )}
        </View>

        {loading ? (
          <View className="bg-surface-container-lowest rounded-3xl p-12 border border-outline-variant/30 items-center justify-center mb-6">
            <ActivityIndicator size="large" className="text-primary mb-4" />
            <Text className="text-on-surface-variant font-medium">Generating report data...</Text>
          </View>
        ) : summary ? (
          <View className="mb-6">
            <View className="bg-surface-container-lowest rounded-3xl p-5 border border-outline-variant/30 shadow-sm relative overflow-hidden">
              <View className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16" />
              
              <View className="bg-primary/10 rounded-2xl p-4 border border-primary/20 mb-5 flex-row items-center">
                <MaterialIcons name="date-range" size={24} className="text-primary mr-3" />
                <View className="flex-1">
                  <Text className="font-label-sm font-bold text-primary uppercase tracking-wider mb-0.5">Date Range</Text>
                  <Text className="font-title-sm font-bold text-on-surface">
                    {formatIstDate(summary.period_start)} – {formatIstDate(summary.period_end)}
                  </Text>
                </View>
              </View>
              
              {/* KPIs Row 1 */}
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1 bg-surface-container-highest/50 rounded-2xl p-4 border border-outline-variant/20">
                  <MaterialIcons name="shopping-cart" size={18} className="text-on-surface-variant mb-2" />
                  <Text className="font-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1">Ordered</Text>
                  <Text className="font-title-lg font-black text-on-surface">
                    {Number(summary.total_ordered_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="font-label-md font-bold text-on-surface-variant">KG</Text>
                  </Text>
                </View>
                <View className="flex-1 bg-primary/5 rounded-2xl p-4 border border-primary/10">
                  <MaterialIcons name="local-shipping" size={18} className="text-primary mb-2" />
                  <Text className="font-label-sm font-bold text-primary uppercase tracking-wider mb-1">Delivered</Text>
                  <Text className="font-title-lg font-black text-primary">
                    {Number(summary.total_delivered_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="font-label-md font-bold text-primary/70">KG</Text>
                  </Text>
                </View>
              </View>
              
              {/* KPIs Row 2 */}
              <View className="flex-row gap-3 mb-3">
                <View className="flex-[1.5] bg-secondary/10 rounded-2xl p-4 border border-secondary/20">
                  <MaterialIcons name="account-balance-wallet" size={18} className="text-secondary mb-2" />
                  <Text className="font-label-sm font-bold text-secondary uppercase tracking-wider mb-1">Total Sales</Text>
                  <Text className="font-headline-sm font-black text-secondary">
                    ₹{Number(summary.total_sales_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View className="flex-1 bg-error-container/30 rounded-2xl p-4 border border-error/20">
                  <MaterialIcons name="trending-down" size={18} className="text-error mb-2" />
                  <Text className="font-label-sm font-bold text-error uppercase tracking-wider mb-1">Loss</Text>
                  <Text className="font-title-lg font-black text-error">
                    {Number(summary.total_loss_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="font-label-md font-bold text-error/70">KG</Text>
                  </Text>
                </View>
              </View>
              
              {/* Collections Full Width */}
              <View className="bg-emerald-100 rounded-2xl p-4 border border-emerald-200 flex-row justify-between items-center">
                <View>
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <MaterialIcons name="payments" size={16} className="text-emerald-700" />
                    <Text className="font-label-sm font-bold text-emerald-800 uppercase tracking-wider">Collections</Text>
                  </View>
                  <Text className="font-headline-sm font-black text-emerald-700">
                    ₹{Number(summary.total_collections).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                  </Text>
                </View>
                <View className="w-12 h-12 rounded-full bg-emerald-200/50 items-center justify-center">
                  <MaterialIcons name="done-all" size={24} className="text-emerald-700" />
                </View>
              </View>
            </View>

            {/* Export Action */}
            <Pressable 
              accessibilityRole="button" 
              className={`h-14 mt-6 rounded-full flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
                isExporting ? 'bg-primary-container' : 'bg-primary shadow-sm shadow-primary/30'
              }`} 
              onPress={sharePdf}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator color="#115E29" />
              ) : (
                <>
                  <MaterialIcons name="picture-as-pdf" size={20} color="white" />
                  <Text className="text-white font-bold text-label-lg uppercase tracking-wider">Export PDF Report</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View className="bg-surface-container-lowest rounded-3xl p-10 border border-dashed border-outline-variant/50 items-center justify-center mb-6">
            <MaterialIcons name="bar-chart" size={48} className="text-on-surface-variant/30 mb-4" />
            <Text className="font-title-md text-on-surface font-bold mb-2">No Data Available</Text>
            <Text className="font-body-md text-on-surface-variant text-center max-w-[250px]">
              Tap refresh or change the date range to generate a report summary.
            </Text>
            <Pressable
              className="mt-6 bg-primary/10 px-6 py-3 rounded-full border border-primary/20 flex-row items-center"
              onPress={refresh}
            >
              <MaterialIcons name="refresh" size={18} className="text-primary mr-2" />
              <Text className="text-primary font-bold">Generate Report</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </AdminScreenContainer>
  );
}
