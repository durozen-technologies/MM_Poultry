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

type Period = "daily"| "weekly"| "monthly";

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
 await Sharing.shareAsync(path, { mimeType: "application/pdf"});
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
 className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#f7f8fa] active:bg-[#f7f8fa]"
 onPress={refresh}
 >
 {loading ? (
 <ActivityIndicator size="small"className="text-[#2E7D32]"/>
 ) : (
 <MaterialIcons name="refresh"size={22} className="text-[#202124]"/>
 )}
 </Pressable>
 }
 />
 }
 >
 <ScrollView className="flex-1 px-4 pt-2"contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
 
 {msg && (
 <View className={`p-4 rounded-lg mb-4 flex-row items-center border ${
 msg.type === 'success' 
 ? 'bg-[#2E7D32]/10/30 border-[#2E7D32]/20' 
 : 'bg-error-container/30 border-error/20'
 }`}>
 <MaterialIcons 
 name={msg.type === 'success' ? "check-circle": "error-outline"} 
 size={20} 
 className={msg.type === 'success' ? "text-[#2E7D32] mr-2": "text-error mr-2"} 
 />
 <Text className={`text-sm font-bold text-[#5f6368] font-semibold flex-1 ${
 msg.type === 'success' ? 'text-[#2E7D32]' : 'text-error'
 }`}>
 {msg.text}
 </Text>
 </View>
 )}

 {/* Configuration Card */}
 <View className="bg-white border border-[#e5e7eb] rounded-lg p-5 mb-6">
 <View className="flex-row items-center gap-2 mb-4">
 <View className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 items-center justify-center">
 <MaterialIcons name="tune"size={16} className="text-[#2E7D32]"/>
 </View>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124]">Report Settings</Text>
 </View>

 <Text className="text-sm font-bold text-[#5f6368] font-semibold text-[#5f6368] uppercase tracking-wider mb-2 ml-1">Period</Text>
 <View className="flex-row bg-[#f7f8fa] rounded-lg p-1 mb-5 border border-[#e5e7eb]">
 {(["daily", "weekly", "monthly"] as const).map((p) => (
 <Pressable
 accessibilityRole="button"
 key={p}
 className={`flex-1 py-2.5 rounded-voltagent-sm items-center transition-colors ${
 period === p ? "bg-[#2E7D32] ": ""
 }`}
 onPress={() => setPeriod(p)}
 >
 <Text className={`text-sm font-bold text-[#5f6368] capitalize ${
 period === p ? "text-white font-bold": "text-[#5f6368]"
 }`}>
 {p}
 </Text>
 </Pressable>
 ))}
 </View>

 <Text className="text-sm font-bold text-[#5f6368] font-semibold text-[#5f6368] uppercase tracking-wider mb-2 ml-1">Reference Date</Text>
 <View className="mb-2">
 <DatePickerField 
 label=""
 value={reportDate} 
 onChange={setReportDate} 
 inputStyle="h-14 bg-white border border-[#e5e7eb] rounded-lg px-4 text-lg text-[#202124]"
 />
 </View>
 </View>

 {/* Results */}
 <View className="flex-row items-center justify-between mb-4 ml-1">
 <Text className="text-2xl font-bold text-[#202124]">Summary Data</Text>
 {summary && (
 <View className="bg-[#2E7D32]/10 px-3 py-1 rounded-lg border border-[#2E7D32]/20">
 <Text className="text-xs font-bold text-[#2E7D32]">Generated</Text>
 </View>
 )}
 </View>

 {loading ? (
 <View className="bg-white rounded-lg p-12 border border-[#e5e7eb] items-center justify-center mb-6">
 <ActivityIndicator size="large"className="text-[#2E7D32] mb-4"/>
 <Text className="text-[#5f6368] font-medium">Generating report data...</Text>
 </View>
 ) : summary ? (
 <View className="mb-6">
 <View className="bg-white rounded-lg p-5 border border-[#e5e7eb] relative overflow-hidden">
 <View className="absolute top-0 right-0 w-32 h-32 bg-[#2E7D32]/5 rounded-lg -translate-y-16 translate-x-16"/>
 
 <View className="bg-[#2E7D32]/10 rounded-lg p-4 border border-[#2E7D32]/20 mb-5 flex-row items-center">
 <MaterialIcons name="date-range"size={24} className="text-[#2E7D32] mr-3"/>
 <View className="flex-1">
 <Text className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider mb-0.5">Date Range</Text>
 <Text className="text-sm font-bold text-[#5f6368] text-[#202124]">
 {formatIstDate(summary.period_start)} – {formatIstDate(summary.period_end)}
 </Text>
 </View>
 </View>
 
 {/* KPIs Row 1 */}
 <View className="flex-row gap-3 mb-3">
 <View className="flex-1 bg-[#f7f8fa]/50 rounded-lg p-4 border border-[#e5e7eb]">
 <MaterialIcons name="shopping-cart"size={18} className="text-[#5f6368] mb-2"/>
 <Text className="text-xs font-bold text-[#5f6368] uppercase tracking-wider mb-1">Ordered</Text>
 <Text className="text-2xl font-bold font-black text-[#202124]">
 {Number(summary.total_ordered_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="text-sm font-bold text-[#5f6368] text-[#5f6368]">KG</Text>
 </Text>
 </View>
 <View className="flex-1 bg-[#2E7D32]/5 rounded-lg p-4 border border-[#2E7D32]/10">
 <MaterialIcons name="local-shipping"size={18} className="text-[#2E7D32] mb-2"/>
 <Text className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider mb-1">Delivered</Text>
 <Text className="text-2xl font-bold font-black text-[#2E7D32]">
 {Number(summary.total_delivered_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="text-sm font-bold text-[#5f6368] text-[#2E7D32]/70">KG</Text>
 </Text>
 </View>
 </View>
 
 {/* KPIs Row 2 */}
 <View className="flex-row gap-3 mb-3">
 <View className="flex-[1.5] bg-[#f7f8fa] border border-[#e5e7eb] rounded-lg p-4 border border-secondary/20">
 <MaterialIcons name="account-balance-wallet"size={18} className="text-secondary mb-2"/>
 <Text className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">Total Sales</Text>
 <Text className="text-lg text-[#5f6368] font-black text-secondary">
 ₹{Number(summary.total_sales_amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
 </Text>
 </View>
 <View className="flex-1 bg-error-container/30 rounded-lg p-4 border border-error/20">
 <MaterialIcons name="trending-down"size={18} className="text-error mb-2"/>
 <Text className="text-xs font-bold text-error uppercase tracking-wider mb-1">Loss</Text>
 <Text className="text-2xl font-bold font-black text-error">
 {Number(summary.total_loss_kg).toLocaleString("en-IN", { maximumFractionDigits: 1 })} <Text className="text-sm font-bold text-[#5f6368] text-error/70">KG</Text>
 </Text>
 </View>
 </View>
 
 {/* Collections Full Width */}
 <View className="bg-emerald-100 rounded-lg p-4 border border-emerald-200 flex-row justify-between items-center">
 <View>
 <View className="flex-row items-center gap-1.5 mb-1">
 <MaterialIcons name="payments"size={16} className="text-emerald-700"/>
 <Text className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Collections</Text>
 </View>
 <Text className="text-lg text-[#5f6368] font-black text-emerald-700">
 ₹{Number(summary.total_collections).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
 </Text>
 </View>
 <View className="w-12 h-12 rounded-lg bg-emerald-200/50 items-center justify-center">
 <MaterialIcons name="done-all"size={24} className="text-emerald-700"/>
 </View>
 </View>
 </View>

 {/* Export Action */}
 <Pressable 
 accessibilityRole="button"
 className={`h-14 mt-6 rounded-lg flex-row items-center justify-center gap-2 active:scale-[0.98] transition-transform ${
 isExporting ? 'bg-[#2E7D32]/10' : 'bg-[#2E7D32] '
 }`} 
 onPress={sharePdf}
 disabled={isExporting}
 >
 {isExporting ? (
 <ActivityIndicator color="#115E29"/>
 ) : (
 <>
 <MaterialIcons name="picture-as-pdf"size={20} color="white"/>
 <Text className="text-white font-bold text-base font-bold uppercase tracking-wider">Export PDF Report</Text>
 </>
 )}
 </Pressable>
 </View>
 ) : (
 <View className="bg-white rounded-lg p-10 border border-dashed border-[#e5e7eb] items-center justify-center mb-6">
 <MaterialIcons name="bar-chart"size={48} className="text-[#5f6368]/30 mb-4"/>
 <Text className="text-base font-bold text-[#5f6368] text-[#202124] mb-2">No Data Available</Text>
 <Text className="text-base text-[#5f6368] text-[#5f6368] text-center max-w-[250px]">
 Tap refresh or change the date range to generate a report summary.
 </Text>
 <Pressable
 className="mt-6 bg-[#2E7D32]/10 px-6 py-3 rounded-lg border border-[#2E7D32]/20 flex-row items-center"
 onPress={refresh}
 >
 <MaterialIcons name="refresh"size={18} className="text-[#2E7D32] mr-2"/>
 <Text className="text-[#2E7D32]">Generate Report</Text>
 </Pressable>
 </View>
 )}
 </ScrollView>
 </AdminScreenContainer>
 );
}
