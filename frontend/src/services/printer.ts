import { Platform, Share } from "react-native";
import { formatReceipt } from "./ble-scale";

export type PrintPayload = {
  shopName: string;
  billNumber: string;
  retailerName: string;
  weightKg: string;
  rate: string;
  total: string;
  cash: string;
  upi: string;
  balance: string;
};

export async function printThermalReceipt(payload: PrintPayload): Promise<"PRINTED" | "SKIPPED"> {
  const text = formatReceipt([
    "BROILER WHOLESALE",
    payload.shopName,
    `Bill: ${payload.billNumber}`,
    `Retailer: ${payload.retailerName}`,
    `Weight: ${payload.weightKg} kg`,
    `Rate: ${payload.rate}`,
    `Total: ${payload.total}`,
    `Cash: ${payload.cash}  UPI: ${payload.upi}`,
    `Balance: ${payload.balance}`,
    "Thank you",
  ]);

  if (Platform.OS === "android") {
    try {
      // Optional native module — may be absent in Expo Go.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ThermalPrinter = require("@haroldtran/react-native-thermal-printer");
      if (ThermalPrinter?.printBluetooth) {
        await ThermalPrinter.printBluetooth({ payload: text });
        return "PRINTED";
      }
    } catch {
      // fall through to share/skip
    }
  }

  // Dev/web fallback: treat as printed after sharing text preview.
  try {
    await Share.share({ message: text });
    return "PRINTED";
  } catch {
    return "SKIPPED";
  }
}

export async function shareWhatsAppBill(message: string): Promise<void> {
  await Share.share({ message });
}
