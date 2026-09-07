import { Alert, Linking, Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
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
 * Generate a PDF receipt and share it via the native share sheet.
 * This replaces the text-based whatsapp:// intent which doesn't support file attachments easily.
 */
export async function shareWhatsAppBill(payload: PrintPayload, phone?: string | null): Promise<void> {
  const html = `
    <html>
      <body style="font-family: sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; border: 1px solid #ccc; border-radius: 8px;">
        <h2 style="text-align: center; margin-bottom: 5px;">BROILER WHOLESALE</h2>
        <h3 style="text-align: center; margin-top: 0; color: #555;">${payload.shopName}</h3>
        <hr />
        <p><strong>Bill No:</strong> ${payload.billNumber}<br/>
        <strong>Date:</strong> ${new Date().toLocaleDateString()}<br/>
        <strong>Retailer:</strong> ${payload.retailerName}</p>
        <hr />
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 1px solid #ccc;">
            <th style="text-align: left; padding-bottom: 5px;">Item</th>
            <th style="text-align: right; padding-bottom: 5px;">Wt</th>
            <th style="text-align: right; padding-bottom: 5px;">Rate</th>
            <th style="text-align: right; padding-bottom: 5px;">Amt</th>
          </tr>
          ${payload.items?.map(it => `
            <tr>
              <td style="padding: 5px 0;">${it.name}</td>
              <td style="text-align: right; padding: 5px 0;">${it.weightKg}</td>
              <td style="text-align: right; padding: 5px 0;">₹${it.rate}</td>
              <td style="text-align: right; padding: 5px 0;">₹${it.amount}</td>
            </tr>
          `).join('') || `<tr><td colspan="4" style="text-align:center; padding: 5px 0;">Weight: ${payload.weightKg} kg | Rate: ₹${payload.rate}</td></tr>`}
        </table>
        <hr />
        <p style="text-align: right; font-size: 1.2em; margin: 5px 0;"><strong>Total: ₹${payload.total}</strong></p>
        <p style="text-align: right; margin: 2px 0;">Cash: ₹${payload.cash} | UPI: ₹${payload.upi}</p>
        <p style="text-align: right; margin: 2px 0;"><strong>Balance: ₹${payload.balance}</strong></p>
        <hr />
        <p style="text-align: center; color: #777; font-size: 0.9em;">Thank you! Visit again</p>
      </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ 
      html, 
      margins: { left: 20, right: 20, top: 20, bottom: 20 } 
    });

    if (Platform.OS === "web") {
      // On web, just open the PDF in a new tab or trigger download
      window.open(uri, "_blank");
      return;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: 'Share Bill'
      });
    } else {
      throw new Error("Sharing not available on this device");
    }
  } catch (e) {
    throw e;
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
