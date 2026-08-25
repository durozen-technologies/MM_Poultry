import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailerDashboard } from "../../api/retailer";
import type { RetailerDashboard } from "../../types/api";
import { formatIstDate, parseIstDate } from "../../utils/ist-date";

function estimatedDeliveryLabel(orderDate: string): string {
  const d = parseIstDate(orderDate);
  if (!d) return "—";
  d.setDate(d.getDate() + 1);
  return formatIstDate(d);
}

export function RetailerDashboardScreen({ navigation }: { navigation: any }) {
  const [dashboard, setDashboard] = useState<RetailerDashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getRetailerDashboard();
      setDashboard(data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setBusy(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const todayOrder = dashboard?.today_order;

  return (
    <SafeAreaView className="flex-1 max-w-3xl mx-auto w-full bg-background" edges={["top"]}>
      <View className="h-16 px-4 flex-row items-center justify-between bg-surface/80">
        <Text className="font-headline-sm text-headline-sm text-on-surface">Home</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Button"
          className="w-11 h-11 items-center justify-center rounded-full active:bg-surface-variant/50"
          onPress={refresh}
        >
          <MaterialIcons name="refresh" size={24} className="text-on-surface" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
      >
        {message ? (
          <View className="bg-error-container rounded-lg px-3 py-2 mb-3">
            <Text className="text-error text-center text-label-md">{message}</Text>
          </View>
        ) : null}

        {!dashboard && busy ? (
          <ActivityIndicator className="text-primary mt-8" />
        ) : null}

        {dashboard ? (
          <View className="flex-col gap-4">
            <View className="bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30">
              <Text className="font-headline-sm text-on-surface font-semibold mb-3">
                Today&apos;s Order
              </Text>
              {todayOrder ? (
                <View className="flex-col gap-2">
                  <Text className="font-display-md text-primary">{todayOrder.items?.reduce((s, it) => s + Number(it.requested_kg || 0), 0) || 0} kg</Text>
                  <Text className="font-body-md text-on-surface-variant">
                    {todayOrder.items?.map(it => it.bird_size).filter(Boolean).join(", ") || "Any size"} · {todayOrder.status}
                  </Text>
                  <Text className="font-label-md text-on-surface-variant">
                    Est. delivery {estimatedDeliveryLabel(todayOrder.order_date)}
                  </Text>
                </View>
              ) : (
                <Text className="font-body-md text-on-surface-variant mb-3">
                  No order placed for today yet.
                </Text>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel="Button"
                className="bg-primary h-12 rounded-xl items-center justify-center mt-2"
                onPress={() => navigation.navigate("PlaceOrder")}
              >
                <Text className="text-on-primary font-semibold">
                  {todayOrder ? "Update order" : "Place order"}
                </Text>
              </Pressable>
            </View>

            <Text className="font-headline-sm text-on-surface mt-1">Financial Summary</Text>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              <SummaryCard
                icon="account-balance-wallet"
                label="Outstanding"
                value={`₹${dashboard.outstanding}`}
              />
              <SummaryCard
                icon="shopping-bag"
                label="This month purchases"
                value={`₹${dashboard.month_purchase_total}`}
              />
              <SummaryCard
                icon="payments"
                label="This month payments"
                value={`₹${dashboard.month_payment_total}`}
              />
              <SummaryCard
                icon="receipt"
                label="Last payment"
                value={
                  dashboard.last_payment
                    ? `₹${dashboard.last_payment.amount}`
                    : "—"
                }
                hint={
                  dashboard.last_payment
                    ? `${formatIstDate(dashboard.last_payment.payment_date)} · ${dashboard.last_payment.method || "—"}`
                    : undefined
                }
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <View className="w-[48%] bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30">
      <View className="flex-row items-center gap-2 mb-2">
        <MaterialIcons name={icon} size={18} className="text-on-surface" />
        <Text className="font-label-md text-on-surface-variant">{label}</Text>
      </View>
      <Text className="font-headline-sm text-on-surface font-semibold">{value}</Text>
      {hint ? <Text className="font-label-md text-on-surface-variant mt-1">{hint}</Text> : null}
    </View>
  );
}
