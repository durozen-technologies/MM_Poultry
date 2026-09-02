import React, { useCallback, useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRetailerDashboard } from "../../api/retailer";
import { getApiErrorMessage } from "../../api/client";
import type { RetailerDashboard } from "../../types/api";
import { formatIstDate, parseIstDate } from "../../utils/ist-date";
import { useAuthStore } from "../../store/auth-store";

function estimatedDeliveryLabel(orderDate: string): string {
  const d = parseIstDate(orderDate);
  if (!d) return "—";
  d.setDate(d.getDate() + 1);
  return formatIstDate(d);
}

export function RetailerDashboardScreen({ navigation }: { navigation: any }) {
  const user = useAuthStore((s) => s.user);
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
      setMessage(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const todayOrders = useMemo(() => dashboard?.today_orders || [], [dashboard?.today_orders]);
  const editableOrder = useMemo(() => todayOrders.find(o => o.status === "PLACED"), [todayOrders]);

  return (
    <View className="flex-1 bg-surface relative">
      {/* Professional Architectural Header */}
      <View className="absolute top-0 left-0 right-0 h-[220px] bg-[#0052CC]" />

      <SafeAreaView className="flex-1" edges={["top"]}>
        <View className="h-16 px-6 flex-row items-center justify-between">
          <View>
            <Text className="text-white/70 font-label-md uppercase tracking-wider">Welcome back</Text>
            <Text className="font-headline-sm text-white font-bold">{user?.retailer_shop_name || "Retailer"}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Button"
            className="w-10 h-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            onPress={refresh}
          >
            <MaterialIcons name="refresh" size={20} className="text-white" />
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 16, paddingTop: 16 }}
          refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} tintColor="#ffffff" colors={["#0052CC"]} />}
          showsVerticalScrollIndicator={false}
        >
          {message ? (
            <View className="bg-error-container rounded-xl px-4 py-3 mb-4 flex-row items-center">
              <MaterialIcons name="error-outline" size={20} className="text-on-error-container mr-2" />
              <Text className="text-on-error-container text-body-sm flex-1">{message}</Text>
            </View>
          ) : null}

          {!dashboard && busy ? (
            <ActivityIndicator color="#ffffff" className="mt-8" />
          ) : null}

          {dashboard ? (
            <View className="flex-col gap-5">
              
              {/* Orders Status Card */}
              <View className="bg-white rounded-[20px] p-5 shadow-sm border border-black/5 elevation-sm">
                <View className="flex-row items-center gap-2 border-b border-surface-variant/50 pb-3 mb-3">
                  <MaterialCommunityIcons name="truck-delivery-outline" size={22} className="text-[#0052CC]" />
                  <Text className="font-headline-sm text-on-surface font-semibold">
                    Today's Orders
                  </Text>
                </View>

                {todayOrders.length > 0 ? (
                  <View className="flex-col gap-4">
                    {todayOrders.map(order => (
                      <View key={order.id} className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 relative">
                        <View className="absolute right-4 top-4 px-2 py-1 bg-primary-container rounded-md">
                          <Text className="text-on-primary-container text-[10px] font-bold uppercase">{order.status === 'ACKNOWLEDGED' ? 'CONFIRMED' : order.status}</Text>
                        </View>
                        
                        <View className="flex-col gap-2 mt-1">
                          {order.items?.map(it => (
                            <View key={it.item_id} className="flex-row items-baseline gap-1 flex-wrap pr-16">
                              <Text className="font-headline-sm text-on-surface font-bold">{it.item_name || "Item"}</Text>
                              <Text className="font-body-md text-on-surface-variant font-medium ml-1">
                                {it.total_boxes || 0} Boxes
                              </Text>
                              {it.requested_kg ? (
                                <Text className="font-body-md text-on-surface-variant ml-1">({it.requested_kg} kg)</Text>
                              ) : null}
                            </View>
                          ))}

                          <Text className="font-body-sm text-on-surface-variant mt-2">
                            <Text className="font-semibold text-on-surface">Est. Delivery: </Text>
                            {estimatedDeliveryLabel(order.order_date)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View className="py-2 items-center flex-col">
                    <MaterialCommunityIcons name="clipboard-text-off-outline" size={32} className="text-outline-variant mb-2" />
                    <Text className="font-body-md text-on-surface-variant text-center">
                      No order placed for today yet.
                    </Text>
                  </View>
                )}
                
                <Pressable accessibilityRole="button" accessibilityLabel="Button"
                  className="bg-[#0052CC] h-12 rounded-xl items-center justify-center mt-5 active:opacity-85"
                  onPress={() => {
                    if (editableOrder) {
                      navigation.navigate("PlaceOrder", { orderId: editableOrder.id });
                    } else {
                      navigation.navigate("PlaceOrder");
                    }
                  }}
                >
                  <Text className="text-white font-bold tracking-wide">
                    {editableOrder ? "UPDATE ORDER" : "PLACE NEW ORDER"}
                  </Text>
                </Pressable>
              </View>

              <Text className="font-headline-sm text-on-surface font-bold px-1 mt-2">Financial Overview</Text>
              
              <View className="flex-row flex-wrap justify-between gap-y-3">
                <SummaryCard
                  icon="account-balance-wallet"
                  label="Outstanding Due"
                  value={`₹${dashboard.outstanding}`}
                  isDebt={Number(dashboard.outstanding) > 0}
                />
                <SummaryCard
                  icon="shopping-bag"
                  label="Month Purchases"
                  value={`₹${dashboard.month_purchase_total}`}
                />
                <SummaryCard
                  icon="payments"
                  label="Month Payments"
                  value={`₹${dashboard.month_payment_total}`}
                  isCredit={Number(dashboard.month_payment_total) > 0}
                />
                <SummaryCard
                  icon="receipt"
                  label="Last Payment"
                  value={
                    dashboard.last_payment
                      ? `₹${dashboard.last_payment.amount}`
                      : "—"
                  }
                  hint={
                    dashboard.last_payment
                      ? `${formatIstDate(dashboard.last_payment.payment_date)}`
                      : undefined
                  }
                />
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const SummaryCard = React.memo(({
  icon,
  label,
  value,
  hint,
  isDebt,
  isCredit,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string;
  hint?: string;
  isDebt?: boolean;
  isCredit?: boolean;
}) => {
  return (
    <View className="w-[48%] bg-white rounded-2xl p-4 border border-black/5 shadow-sm elevation-sm flex-col justify-between min-h-[110px]">
      <View className="flex-row items-center gap-2 mb-2">
        <View className="w-8 h-8 rounded-full bg-surface-container-lowest items-center justify-center border border-outline-variant/30">
          <MaterialIcons name={icon} size={16} className="text-[#0052CC]" />
        </View>
        <Text className="font-label-sm text-on-surface-variant flex-1" numberOfLines={2}>{label}</Text>
      </View>
      <View>
        <Text className={`font-headline-sm font-bold ${isDebt ? 'text-error' : isCredit ? 'text-[#0052CC]' : 'text-on-surface'}`}>
          {value}
        </Text>
        {hint ? <Text className="font-body-xs text-on-surface-variant mt-1 opacity-80">{hint}</Text> : null}
      </View>
    </View>
  );
});
