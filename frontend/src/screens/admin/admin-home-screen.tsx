import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../../api/client";
import { DatePickerField } from "../../components/date-picker-field";
import { useAuthStore } from "../../store/auth-store";
import type {
  DailyOrder,
  FarmLoad,
  OpsDashboard,
  ReportSummary,
  Retailer,
  Vehicle,
} from "../../types/api";
import { formatIstDate, toApiDate, todayIstDate } from "../../utils/ist-date";

export function AdminHomeScreen({ navigation }: { navigation: any }) {
  const logout = useAuthStore((s) => s.logout);
  const [orders, setOrders] = useState<DailyOrder[]>([]);
  const [totalKg, setTotalKg] = useState("0");
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loads, setLoads] = useState<FarmLoad[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loadKg, setLoadKg] = useState("100");
  const [vehicle, setVehicle] = useState("");
  const [newVehicle, setNewVehicle] = useState("");
  const [rate, setRate] = useState("180");
  const [loadDate, setLoadDate] = useState(todayIstDate());
  const [reportDate, setReportDate] = useState(todayIstDate());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const [o, r, l, v, dash, rep] = await Promise.all([
        api.get("/admin/orders/today"),
        api.get("/admin/retailers"),
        api.get("/admin/farm-loads"),
        api.get("/admin/vehicles"),
        api.get("/admin/dashboard", {
          params: { on_date: toApiDate(reportDate) },
        }),
        api.get("/admin/reports/summary", {
          params: { period: "daily", on_date: toApiDate(reportDate) },
        }),
      ]);
      setOrders(o.data.items);
      setTotalKg(o.data.total_requested_kg);
      setRetailers(r.data.items);
      setLoads(l.data);
      setVehicles(v.data);
      setDashboard(dash.data);
      setReport(rep.data);
      setMessage(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  }, [reportDate]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    void refresh();
  }, [reportDate]);

  async function createLoad() {
    setBusy(true);
    try {
      await api.post("/admin/farm-loads", {
        load_date: toApiDate(loadDate),
        loaded_weight_kg: loadKg,
        vehicle_number: vehicle || vehicles[0]?.number || null,
        vehicle_id: vehicles[0]?.id || null,
        driver_name: vehicles[0]?.driver_name || "Driver",
      });
      await refresh();
      setMessage("Farm load created");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveVehicle() {
    if (!newVehicle.trim()) return;
    setBusy(true);
    try {
      await api.post("/admin/vehicles", {
        number: newVehicle.trim(),
        driver_name: "Driver",
      });
      setNewVehicle("");
      await refresh();
      setMessage("Vehicle saved");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveDefaultRate() {
    setBusy(true);
    try {
      await api.put("/admin/rates", {
        retailer_id: null,
        rate_per_kg: rate,
      });
      setMessage(`Default rate ₹${rate}/kg saved`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function buildRun() {
    if (!loads[0] || orders.length === 0) {
      setMessage("Need a farm load and at least one order");
      return;
    }
    setBusy(true);
    try {
      await api.post("/admin/delivery-runs", {
        farm_load_id: loads[0].id,
        order_ids: orders.map((o) => o.id),
        run_date: toApiDate(loadDate),
      });
      setMessage("Delivery run created");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 bg-brand-sand">
      <View className="px-4 pt-12 pb-3 flex-row justify-between items-center bg-brand-ink">
        <Text className="text-white text-xl font-bold">Admin</Text>
        <Pressable onPress={() => logout()}>
          <Text className="text-brand-sand">Logout</Text>
        </Pressable>
      </View>
      {busy ? <ActivityIndicator className="mt-4" color="#2f6b3a" /> : null}
      {message ? <Text className="px-4 pt-2 text-brand-clay">{message}</Text> : null}
      <FlatList
        refreshControl={<RefreshControl refreshing={busy} onRefresh={refresh} />}
        ListHeaderComponent={
          <View className="p-4 gap-3">
            <DatePickerField label="Ops / report date" value={reportDate} onChange={setReportDate} />
            {dashboard ? (
              <View className="bg-white rounded-xl p-3 border border-brand-leaf/20 gap-1">
                <Text className="font-semibold text-brand-ink mb-1">
                  Today ops · loss {dashboard.loss_status}
                </Text>
                <Text>
                  Orders {dashboard.order_count} · {dashboard.ordered_kg} kg ordered
                </Text>
                <Text>
                  Loaded {dashboard.loaded_kg} → delivered {dashboard.delivered_kg} kg
                </Text>
                <Text>
                  Sales ₹{dashboard.total_sales} · collected ₹{dashboard.total_collection}
                </Text>
                <Text>Outstanding ₹{dashboard.outstanding}</Text>
                <Text>
                  Loss {dashboard.loss_kg} kg ({dashboard.loss_pct}%) · billed{" "}
                  {dashboard.completed_deliveries} / pending {dashboard.pending_deliveries}
                </Text>
              </View>
            ) : null}
            <Text className="text-brand-ink text-lg font-semibold">
              Today orders · {totalKg} kg
            </Text>
            {report ? (
              <View className="bg-white rounded-xl p-3 border border-brand-leaf/20">
                <Text className="font-semibold text-brand-ink mb-1">
                  Report {report.period_start} – {report.period_end}
                </Text>
                <Text>Delivered {report.total_delivered_kg} kg</Text>
                <Text>Sales ₹{report.total_sales_amount}</Text>
                <Text>Collections ₹{report.total_collections}</Text>
                <Text>Loss {report.total_loss_kg} kg</Text>
              </View>
            ) : null}
            <Text className="text-brand-ink font-semibold mt-2">Default rate</Text>
            <TextInput
              className="bg-white border rounded-lg px-3 py-2"
              value={rate}
              onChangeText={setRate}
              placeholder="₹ per kg"
              keyboardType="decimal-pad"
            />
            <Pressable className="bg-brand-ink rounded-lg py-3 items-center" onPress={saveDefaultRate}>
              <Text className="text-white font-semibold">Save default rate</Text>
            </Pressable>
            <Text className="text-brand-ink font-semibold mt-2">Vehicles</Text>
            <TextInput
              className="bg-white border rounded-lg px-3 py-2"
              value={newVehicle}
              onChangeText={setNewVehicle}
              placeholder="New vehicle number"
              autoCapitalize="characters"
            />
            <Pressable
              className="border border-brand-ink rounded-lg py-3 items-center"
              onPress={saveVehicle}
            >
              <Text className="text-brand-ink font-semibold">Add vehicle</Text>
            </Pressable>
            {vehicles.map((v) => (
              <Text key={v.id} className="text-xs text-brand-ink">
                {v.number} · {v.driver_name || "no driver"}
              </Text>
            ))}
            <Text className="text-brand-ink font-semibold mt-2">Farm load</Text>
            <DatePickerField label="Load date" value={loadDate} onChange={setLoadDate} />
            <TextInput
              className="bg-white border rounded-lg px-3 py-2"
              value={loadKg}
              onChangeText={setLoadKg}
              placeholder="Loaded kg"
              keyboardType="decimal-pad"
            />
            <TextInput
              className="bg-white border rounded-lg px-3 py-2"
              value={vehicle}
              onChangeText={setVehicle}
              placeholder={vehicles[0]?.number || "Vehicle number"}
            />
            <Pressable className="bg-brand-leaf rounded-lg py-3 items-center" onPress={createLoad}>
              <Text className="text-white font-semibold">Save farm load</Text>
            </Pressable>
            <Pressable className="bg-brand-clay rounded-lg py-3 items-center" onPress={buildRun}>
              <Text className="text-white font-semibold">Build run from today orders</Text>
            </Pressable>
            <Pressable
              className="border border-brand-leaf rounded-lg py-3 items-center"
              onPress={() => navigation.navigate("Retailers")}
            >
              <Text className="text-brand-leaf font-semibold">Retailers & ledger</Text>
            </Pressable>
            <Text className="text-brand-ink font-semibold mt-2">Orders</Text>
          </View>
        }
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="mx-4 mb-2 bg-white rounded-lg p-3 border border-black/5">
            <Text className="font-semibold">{item.retailer_name}</Text>
            <Text>
              {formatIstDate(item.order_date)} · {item.requested_kg} kg · {item.status}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <View className="p-4">
            <Text className="font-semibold mb-2">Retailers ({retailers.length})</Text>
            {retailers.map((r) => (
              <Text key={r.id} className="mb-1">
                {r.name} · due ₹{r.credit_balance}
                {r.credit_limit && Number(r.credit_limit) > 0 ? ` / limit ₹${r.credit_limit}` : ""}
              </Text>
            ))}
            {loads[0] ? (
              <Text className="mt-2 text-xs text-brand-ink">
                Latest load {formatIstDate(loads[0].load_date)} · {loads[0].loaded_weight_kg} kg
              </Text>
            ) : null}
          </View>
        }
      />
    </View>
  );
}
