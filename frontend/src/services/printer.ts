import { Alert, Linking, Platform, Share } from "react-native";
import { formatReceipt, sanitizeForThermal } from "./ble-scale";
import { printText } from "../utils/printer";
import { usePrinterStore } from "../store/printer-store";

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
  items?: { name: string; weightKg: string; rate: string; amount: string }[];
};

// ESC/POS helpers for 58mm (32 chars) and 80mm (48 chars)
function buildEscPosText(payload: PrintPayload, width: 32 | 48 = 32): string {
  const w = width;
  const line = "-".repeat(w);
  const center = (s: string) => {
    const pad = Math.max(0, Math.floor((w - s.length) / 2));
    return " ".repeat(pad) + s;
  };
  const row = (left: string, right: string) => {
    const space = w - left.length - right.length;
    if (space < 1) return left + " " + right;
    return left + " ".repeat(space) + right;
  };
  const lines: string[] = [];
  lines.push(center("BROILER WHOLESALE"));
  lines.push(center(payload.shopName));
  lines.push(line);
  lines.push(row(`Bill: ${payload.billNumber}`, new Date().toLocaleDateString()));
  lines.push(`Retailer: ${payload.retailerName}`);
  lines.push(line);
  if (payload.items && payload.items.length > 0) {
    lines.push(row("Item", "Wt  Rate  Amt"));
    lines.push(line);
    for (const it of payload.items) {
      const left = it.name.slice(0, 14);
      const right = `${it.weightKg} ${it.rate} ${it.amount}`;
      lines.push(row(left, right));
    }
    lines.push(line);
  } else {
    lines.push(`Weight: ${payload.weightKg} kg   Rate: ${payload.rate}`);
  }
  lines.push(row("Total:", `Rs ${payload.total}`));
  lines.push(row("Cash:", `Rs ${payload.cash}`));
  lines.push(row("UPI:", `Rs ${payload.upi}`));
  lines.push(row("Balance:", `Rs ${payload.balance}`));
  lines.push(line);
  lines.push(center("Thank you! Visit again"));
  return sanitizeForThermal(lines.join("\n"));
}

async function tryNativePrint(text: string): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  try {
    const printer = usePrinterStore.getState().connectedPrinter;
    if (!printer) {
      console.warn("No printer configured.");
      return false; // Will fall back to Share
    }
    
    await printText(printer, text);
    return true;
  } catch (e) {
    // Module not installed (Expo Go) or connection failed — fall through
    console.warn("Thermal printer not available:", (e as Error)?.message);
  }
  return false;
}

export async function printThermalReceipt(payload: PrintPayload): Promise<"PRINTED" | "FAILED" | "SKIPPED"> {
  const text58 = buildEscPosText(payload, 32);
  const fallbackText = formatReceipt([
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

  // 1) Try native Bluetooth thermal print
  const printed = await tryNativePrint(text58);
  if (printed) return "PRINTED";

  // 2) Fallback: system Share sheet ( lets user Save/Print/Share )
  // On web, this still counts as PRINTED (no hardware)
  if (Platform.OS === "web") {
    try {
      await Share.share({ message: fallbackText });
      return "PRINTED";
    } catch {
      return "FAILED";
    }
  }

  try {
    const result = await Share.share({ message: fallbackText });
    if ((result as { action?: string })?.action === Share.dismissedAction) {
      return "SKIPPED";
    }
    return "PRINTED";
  } catch {
    return "FAILED";
  }
}

/**
 * Open WhatsApp with prefilled bill message.
 * Uses whatsapp:// deep link when available, falls back to Share.
 * Validates phone (optional) and handles dismiss vs success.
 */
export async function shareWhatsAppBill(message: string, phone?: string | null): Promise<void> {
  const sanitized = sanitizeForThermal(message);
  // Prefer native WhatsApp deep link when phone is known or app is installed
  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  const encoded = encodeURIComponent(sanitized);

  const waUrl = phoneDigits
    ? `whatsapp://send?phone=${phoneDigits}&text=${encoded}`
    : `whatsapp://send?text=${encoded}`;

  try {
    const canOpen = await Linking.canOpenURL(waUrl);
    if (canOpen) {
      await Linking.openURL(waUrl);
      return;
    }
  } catch {
    // fall through to Share
  }

  // Fallback: generic share picker (user can choose WhatsApp)
  const result = await Share.share({ message: sanitized });
  if ((result as { action?: string })?.action === Share.dismissedAction) {
    throw new Error("Share dismissed");
  }
}

/** List bonded Bluetooth devices (for printer selection). Returns [] on Expo Go/web. */
export async function listBondedBluetoothDevices(): Promise<{ id: string; name: string }[]> {
  if (Platform.OS !== "android") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@haroldtran/react-native-thermal-printer");
    const ThermalPrinter = mod?.default ?? mod;
    if (ThermalPrinter?.getBluetoothDeviceList) {
      const list: { innerMacAddress: string; deviceName: string }[] = await ThermalPrinter.getBluetoothDeviceList();
      return list.map((d) => ({ id: d.innerMacAddress, name: d.deviceName }));
    }
  } catch {}
  return [];
}
