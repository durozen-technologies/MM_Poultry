import { MaterialIcons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { Modal, View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, SafeAreaView } from "react-native";
import { usePrinterStore } from "../store/printer-store";
import { PrinterDevice } from "../types/printer";
import { DeliveryReceiptData } from "../utils/printer";
import {
  getPrinterSupportState,
  loadBluetoothPrinters,
  connectPrinterDevice,
} from "../utils/printer";
import { useReceiptImagePrintJob } from "../hooks/use-receipt-image-print-job";

type PrinterSetupModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function PrinterSetupModal({ visible, onClose }: PrinterSetupModalProps) {
  const [printers, setPrinters] = useState<PrinterDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { connectedPrinter, setPrinter, disconnectPrinter } = usePrinterStore();
  const { receiptImagePrintBridge, startReceiptImagePrintJob } = useReceiptImagePrintJob();

  useEffect(() => {
    if (visible) {
      void scanPrinters();
    }
  }, [visible]);

  async function scanPrinters() {
    setLoading(true);
    setError(null);
    setPrinters([]);

    const support = getPrinterSupportState();
    if (!support.supported) {
      setError(support.reason ?? "Printers not supported on this device.");
      setLoading(false);
      return;
    }

    try {
      const foundPrinters = await loadBluetoothPrinters();
      setPrinters(foundPrinters);
    } catch (e: any) {
      const errMsg = e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
      setError(errMsg || "Failed to scan for printers");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(device: PrinterDevice) {
    try {
      setLoading(true);
      setError(null);
      await connectPrinterDevice(device);
      await setPrinter(device);
      Alert.alert("Success", `Connected to ${device.name}`);
    } catch (e: any) {
      setError(e.message || "Failed to connect to printer");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestPrint() {
    if (!connectedPrinter) return;
    try {
      setLoading(true);
      setError(null);
      
      const dummyData: DeliveryReceiptData = {
        receipt_number: "TEST",
        receipt_type: "TEST",
        date: new Date().toISOString(),
        agency_name: "PRINTER CONNECTED",
        agency_address: `Name: ${connectedPrinter.name || "Unknown"}`,
        agency_mobile: connectedPrinter.address ? `Address: ${connectedPrinter.address}` : "",
        buyer_name: "",
        buyer_address: "",
        items: [],
        total_bill: 0,
        cash_collected: 0,
        upi_collected: 0,
        opening_balance: 0,
        closing_balance: 0,
      };

      await startReceiptImagePrintJob([dummyData], connectedPrinter);
      Alert.alert("Success", "Test receipt printed.");
    } catch (e: any) {
      setError(e.message || "Failed to print test receipt");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectPrinter();
      Alert.alert("Disconnected", "Printer has been disconnected.");
    } catch (e: any) {
      setError(e.message || "Failed to disconnect printer");
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      {receiptImagePrintBridge}
      <View className="flex-1 justify-end bg-black/50">
        <SafeAreaView className="bg-white rounded-t-3xl min-h-[60%] p-6">
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold text-gray-900">Thermal Printer Setup</Text>
            <TouchableOpacity onPress={onClose} className="p-2 bg-gray-100 rounded-full">
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {error && (
            <View className="bg-red-50 p-4 rounded-xl mb-4">
              <Text className="text-red-600 font-medium">{error}</Text>
            </View>
          )}

          <View className="mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <Text className="text-gray-500 text-sm font-medium mb-1">Status</Text>
            {connectedPrinter ? (
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center flex-1">
                  <View className="w-2.5 h-2.5 rounded-full bg-green-500 mr-2" />
                  <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>
                    {connectedPrinter.name}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleDisconnect} className="ml-2 bg-red-100 px-3 py-1.5 rounded-full">
                  <Text className="text-red-700 font-bold text-xs">Disconnect</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                <Text className="text-gray-900 font-bold text-base">Not Connected</Text>
              </View>
            )}

            {connectedPrinter && (
              <TouchableOpacity
                onPress={handleTestPrint}
                disabled={loading}
                className={`mt-4 ${loading ? "bg-blue-50" : "bg-blue-100"} py-3 rounded-xl flex-row items-center justify-center active:bg-blue-200`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#0052CC" />
                ) : (
                  <>
                    <MaterialIcons name="print" size={20} color="#0052CC" className="mr-2" />
                    <Text className="text-[#0052CC] font-bold text-sm ml-2">Print Test Receipt</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-gray-900">Available Printers</Text>
            <TouchableOpacity onPress={scanPrinters} disabled={loading}>
              <MaterialIcons name="refresh" size={24} color={loading ? "#9CA3AF" : "#0052CC"} />
            </TouchableOpacity>
          </View>

          {loading && !printers.length ? (
            <View className="flex-1 items-center justify-center py-10">
              <ActivityIndicator size="large" color="#0052CC" />
              <Text className="text-gray-500 mt-4 font-medium">Scanning for printers...</Text>
            </View>
          ) : (
            <FlatList
              data={printers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View className="items-center justify-center py-8">
                  <MaterialIcons name="bluetooth-searching" size={48} color="#D1D5DB" />
                  <Text className="text-gray-500 text-center mt-4">
                    No bluetooth printers found. Make sure it's turned on and discoverable.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isActive = connectedPrinter?.id === item.id;
                return (
                  <TouchableOpacity
                    onPress={() => handleConnect(item)}
                    disabled={isActive || loading}
                    className={`p-4 mb-3 rounded-2xl flex-row items-center justify-between border ${
                      isActive ? "bg-blue-50 border-blue-200" : "bg-white border-gray-200"
                    }`}
                  >
                    <View className="flex-row items-center flex-1">
                      <MaterialIcons
                        name="print"
                        size={24}
                        color={isActive ? "#0052CC" : "#6B7280"}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          className={`font-bold text-base ${
                            isActive ? "text-[#0052CC]" : "text-gray-900"
                          }`}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text className="text-gray-500 text-xs mt-0.5">{item.address}</Text>
                      </View>
                    </View>
                    {isActive ? (
                      <MaterialIcons name="check-circle" size={24} color="#0052CC" />
                    ) : (
                      <View className="bg-gray-100 px-3 py-1.5 rounded-full">
                        <Text className="text-gray-700 font-bold text-xs">Connect</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
