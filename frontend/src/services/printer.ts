import { Platform, Share } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { formatReceipt } from "./ble-scale";
import { formatIstDate, formatIstTime, parseIstDate, todayIstDate } from "../utils/ist-date";
import { usePrinterStore } from "../store/printer-store";
import { runReceiptImagePrintJob } from "./receipt-print-registry";
import type { DeliveryReceiptData } from "../utils/printer";
import { getCommandText, printText } from "../utils/printer";
import { buildReceiptExportPayload } from "../utils/printer-html";

export type PrintLineItem = {
  name: string;
  boxes: string;
  weightKg: string;
  rate: string;
  amount: string;
};

export type PrintPayload = {
  organizationName: string;
  shopName: string;
  billNumber: string;
  billDate: string;
  billTime: string;
  retailerName: string;
  routeName?: string;
  stopSequence?: number;
  totalBoxes: string;
  weightKg: string;
  total: string;
  cash: string;
  upi: string;
  balance: string;
  items: PrintLineItem[];
};

type BillLike = {
  bill_number: string;
  bill_date?: string | null;
  total_amount: string;
  cash_payment: string;
  upi_payment: string;
  balance_amount: string;
  items?: { item_id: string; weight_kg: string; rate_per_kg: string; amount: string }[];
};

type StopLike = {
  retailer_name?: string | null;
  shop_name?: string | null;
  route_name?: string | null;
  sequence?: number;
  items?: { item_id: string; delivered_boxes?: number | null }[];
};

export type ReceiptPrintOptions = {
  organizationName?: string | null;
};

function parseAmount(value: string | number): number {
  if (typeof value === "number") return value;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: string | number): string {
  const n = parseAmount(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtKg(value: string | number): string {
  const n = parseAmount(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function payloadToReceiptDate(payload: PrintPayload): string {
  const parsed = parseIstDate(payload.billDate);
  if (parsed) return parsed.toISOString();
  return todayIstDate().toISOString();
}

function buildRouteInfo(payload: PrintPayload): string | undefined {
  const bits = [
    payload.routeName ? `Route: ${payload.routeName}` : null,
    payload.stopSequence ? `Stop #${payload.stopSequence}` : null,
  ].filter(Boolean);
  return bits.length > 0 ? bits.join("  ·  ") : undefined;
}

/** Map delivery bill payload to the same receipt model used by test print. */
export function printPayloadToDeliveryReceiptData(payload: PrintPayload): DeliveryReceiptData {
  const shopDifferent =
    payload.shopName && payload.shopName !== payload.retailerName ? payload.shopName : "";

  return {
    receipt_number: payload.billNumber,
    receipt_type: "DELIVERY",
    date: payloadToReceiptDate(payload),
    agency_name: payload.organizationName,
    agency_address: "BROILER WHOLESALE",
    buyer_name: payload.retailerName,
    buyer_address: shopDifferent,
    route_info: buildRouteInfo(payload),
    opening_balance: 0,
    items: payload.items.map((it) => ({
      name: it.name,
      quantity: Number(it.boxes) || 0,
      price: Number(it.rate) || 0,
      total: Number(it.amount) || 0,
      quantity_display: `${it.boxes} / ${fmtKg(it.weightKg)}`,
      rate_line: `₹${fmtMoney(it.rate)}/kg`,
    })),
    total_bill: parseAmount(payload.total),
    cash_collected: parseAmount(payload.cash),
    upi_collected: parseAmount(payload.upi),
    total_boxes: parseAmount(payload.totalBoxes),
    total_weight_kg: parseAmount(payload.weightKg),
    closing_balance: 0,
  };
}

export function deliveryBillToPrintPayload(
  bill: BillLike,
  stop: StopLike,
  getItemName: (id: string) => string,
  options?: ReceiptPrintOptions
): PrintPayload {
  const boxesByItem = new Map(
    (stop.items || []).map((it) => [it.item_id, Number(it.delivered_boxes ?? 0)])
  );
  const items: PrintLineItem[] = (bill.items || []).map((it) => ({
    name: getItemName(it.item_id),
    boxes: String(boxesByItem.get(it.item_id) ?? 0),
    weightKg: String(it.weight_kg),
    rate: String(it.rate_per_kg),
    amount: String(it.amount),
  }));
  const totalWeight = items.reduce((sum, it) => sum + Number(it.weightKg || 0), 0);
  const totalBoxes = items.reduce((sum, it) => sum + Number(it.boxes || 0), 0);
  const orgName = options?.organizationName || stop.shop_name || stop.retailer_name || "MM Broilers";

  return {
    organizationName: orgName,
    shopName: stop.shop_name || stop.retailer_name || "Customer",
    billNumber: bill.bill_number,
    billDate: bill.bill_date ? formatIstDate(bill.bill_date) : formatIstDate(todayIstDate()),
    billTime: formatIstTime(),
    retailerName: stop.retailer_name || "Retailer",
    routeName: stop.route_name || undefined,
    stopSequence: stop.sequence,
    totalBoxes: String(totalBoxes),
    weightKg: fmtKg(totalWeight),
    total: String(bill.total_amount),
    cash: String(bill.cash_payment || 0),
    upi: String(bill.upi_payment || 0),
    balance: String(bill.balance_amount || 0),
    items,
  };
}

/** Plain-text fallback for share sheet (web / no printer). */
export function buildReceiptLines(payload: PrintPayload): string[] {
  const exportPayload = buildReceiptExportPayload(printPayloadToDeliveryReceiptData(payload));
  const lines: string[] = [
    exportPayload.companyName,
    exportPayload.shopName,
    exportPayload.receiptTitleText || "",
    exportPayload.receiptNumberText,
    exportPayload.dateText,
    exportPayload.toText,
    exportPayload.buyerName,
    exportPayload.buyerShopName || "",
    exportPayload.routeInfoText || "",
    "--------------------------------",
    `${exportPayload.itemHeader}  ${exportPayload.quantityHeader}  ${exportPayload.totalHeader}`,
  ];

  for (const it of exportPayload.items) {
    lines.push(`${it.itemName}  ${it.quantityText}  ${it.lineTotal}`);
  }

  lines.push(
    "--------------------------------",
    exportPayload.totalBoxesLabel && exportPayload.totalBoxesValue
      ? `${exportPayload.totalBoxesLabel} ${exportPayload.totalBoxesValue}`
      : "",
    exportPayload.totalWeightLabel && exportPayload.totalWeightValue
      ? `${exportPayload.totalWeightLabel} ${exportPayload.totalWeightValue}`
      : "",
    exportPayload.totalLabel && exportPayload.totalValue
      ? `${exportPayload.totalLabel} ${exportPayload.totalValue}`
      : "",
    `${exportPayload.cashLabel} ${exportPayload.cashValue}`,
    `${exportPayload.upiLabel} ${exportPayload.upiValue}`,
    exportPayload.balanceAmountLabel && exportPayload.balanceAmountValue
      ? `${exportPayload.balanceAmountLabel} ${exportPayload.balanceAmountValue}`
      : "",
    exportPayload.thankYou,
    exportPayload.poweredBy,
    exportPayload.provider,
  );

  return lines.filter(Boolean);
}

function buildSharePdfHtml(payload: PrintPayload): string {
  const exportPayload = buildReceiptExportPayload(printPayloadToDeliveryReceiptData(payload));
  const itemRows = exportPayload.items
    .map(
      (it) => `
      <tr>
        <td style="padding:5px 0;vertical-align:top;">${escapeHtml(it.itemName.replace("\n", "<br/>"))}</td>
        <td style="text-align:right;padding:5px 0;">${escapeHtml(it.quantityText)}</td>
        <td style="text-align:right;padding:5px 0;font-weight:700;">${escapeHtml(it.lineTotal)}</td>
      </tr>`
    )
    .join("");

  return `
    <html><head><meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #000; margin: 0; padding: 12px; }
      h1,h2 { text-align: center; margin: 0 0 4px; }
      h2 { font-size: 15px; margin-bottom: 10px; }
      .meta { margin: 10px 0; line-height: 1.45; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th { border-bottom: 1px solid #000; padding-bottom: 4px; font-size: 11px; text-transform: uppercase; }
      th:first-child { text-align: left; }
      th:not(:first-child) { text-align: right; }
      .row { display:flex; justify-content:space-between; margin: 3px 0; }
      .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #000; margin-top: 8px; padding-top: 6px; }
      .footer { text-align: center; margin-top: 14px; font-size: 12px; }
    </style></head><body>
      <h1>${escapeHtml(exportPayload.companyName)}</h1>
      <h2>${escapeHtml(exportPayload.shopName)}</h2>
      ${exportPayload.receiptTitleText ? `<p style="text-align:center;font-weight:700;">${escapeHtml(exportPayload.receiptTitleText)}</p>` : ""}
      <div class="meta">
        <div>${escapeHtml(exportPayload.receiptNumberText)}</div>
        <div>${escapeHtml(exportPayload.dateText)}</div>
        <div style="margin-top:8px;"><strong>${escapeHtml(exportPayload.toText)}</strong> ${escapeHtml(exportPayload.buyerName)}</div>
        ${exportPayload.buyerShopName ? `<div>${escapeHtml(exportPayload.buyerShopName)}</div>` : ""}
        ${exportPayload.routeInfoText ? `<div>${escapeHtml(exportPayload.routeInfoText)}</div>` : ""}
      </div>
      <table>
        <thead><tr><th>${exportPayload.itemHeader}</th><th>${exportPayload.quantityHeader}</th><th>${exportPayload.totalHeader}</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="margin-top:10px;">
        ${exportPayload.totalBoxesLabel ? `<div class="row"><span>${exportPayload.totalBoxesLabel}</span><span>${exportPayload.totalBoxesValue}</span></div>` : ""}
        ${exportPayload.totalWeightLabel ? `<div class="row"><span>${exportPayload.totalWeightLabel}</span><span>${exportPayload.totalWeightValue}</span></div>` : ""}
        ${exportPayload.totalLabel ? `<div class="row grand"><span>${exportPayload.totalLabel}</span><span>${exportPayload.totalValue}</span></div>` : ""}
        <div class="row"><span>${exportPayload.cashLabel}</span><span>${exportPayload.cashValue}</span></div>
        <div class="row"><span>${exportPayload.upiLabel}</span><span>${exportPayload.upiValue}</span></div>
        ${exportPayload.balanceAmountLabel ? `<div class="row"><span>${exportPayload.balanceAmountLabel}</span><span>${exportPayload.balanceAmountValue}</span></div>` : ""}
      </div>
      <p class="footer">${exportPayload.thankYou}<br/>${exportPayload.poweredBy}<br/><strong>${exportPayload.provider}</strong></p>
    </body></html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEscPosFallback(payload: PrintPayload): string {
  const COMMAND = getCommandText();
  const exportPayload = buildReceiptExportPayload(printPayloadToDeliveryReceiptData(payload));
  const lines: string[] = [
    `${COMMAND.CENTER}${COMMAND.BOLD_ON}${exportPayload.companyName}${COMMAND.BOLD_OFF}`,
    `${COMMAND.CENTER}${exportPayload.shopName}`,
    exportPayload.receiptTitleText ? `${COMMAND.CENTER}${COMMAND.BOLD_ON}${exportPayload.receiptTitleText}${COMMAND.BOLD_OFF}` : "",
    `${COMMAND.CENTER}${exportPayload.receiptNumberText}`,
    `${COMMAND.CENTER}${exportPayload.dateText}`,
    COMMAND.DIVIDER,
    `${COMMAND.LEFT}${exportPayload.toText}`,
    exportPayload.buyerName,
    exportPayload.buyerShopName || "",
    exportPayload.routeInfoText || "",
    COMMAND.DIVIDER,
    `${COMMAND.LEFT}${exportPayload.itemHeader}  ${exportPayload.quantityHeader}  ${exportPayload.totalHeader}`,
    COMMAND.DIVIDER,
  ];

  for (const it of exportPayload.items) {
    lines.push(it.itemName, `  ${it.quantityText}  ${it.lineTotal}`);
  }

  lines.push(
    COMMAND.DIVIDER,
    exportPayload.totalBoxesLabel ? `${exportPayload.totalBoxesLabel} ${exportPayload.totalBoxesValue}` : "",
    exportPayload.totalWeightLabel ? `${exportPayload.totalWeightLabel} ${exportPayload.totalWeightValue}` : "",
    exportPayload.totalLabel ? `${exportPayload.totalLabel} ${exportPayload.totalValue}` : "",
    `${exportPayload.cashLabel} ${exportPayload.cashValue}`,
    `${exportPayload.upiLabel} ${exportPayload.upiValue}`,
    exportPayload.balanceAmountLabel ? `${exportPayload.balanceAmountLabel} ${exportPayload.balanceAmountValue}` : "",
    COMMAND.DIVIDER,
    `${COMMAND.CENTER}${COMMAND.BOLD_ON}${exportPayload.thankYou}${COMMAND.BOLD_OFF}`,
    `${COMMAND.CENTER}${exportPayload.poweredBy}`,
    `${COMMAND.CENTER}${exportPayload.provider}`,
  );

  return lines.filter(Boolean).join("\n");
}

async function printEscPosFallback(
  device: import("../types/printer").PrinterDevice,
  payload: PrintPayload
): Promise<void> {
  await printText(device, buildEscPosFallback(payload));
}

export async function printThermalReceipt(payload: PrintPayload): Promise<"PRINTED" | "FAILED" | "SKIPPED"> {
  const printer = usePrinterStore.getState().connectedPrinter;

  if (Platform.OS === "android") {
    if (!printer) {
      console.warn("printThermalReceipt: No printer connected on Android");
      return "FAILED";
    }
    try {
      const receiptData = printPayloadToDeliveryReceiptData(payload);
      await runReceiptImagePrintJob([receiptData], printer);
      return "PRINTED";
    } catch (e) {
      console.warn("Image receipt print failed, trying text fallback:", (e as Error)?.message);
      try {
        await printEscPosFallback(printer, payload);
        return "PRINTED";
      } catch (fallbackError) {
        console.warn("Text receipt print failed:", (fallbackError as Error)?.message);
        return "FAILED";
      }
    }
  }

  const fallbackText = formatReceipt(buildReceiptLines(payload));

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

export async function shareWhatsAppBill(payload: PrintPayload, _phone?: string | null): Promise<void> {
  const html = buildSharePdfHtml(payload);

  try {
    const { uri } = await Print.printToFileAsync({ 
      html, 
      margins: { left: 12, right: 12, top: 12, bottom: 12 },
    });

    if (Platform.OS === "web") {
      window.open(uri, "_blank");
      return;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(uri, {
        UTI: "com.adobe.pdf",
        mimeType: "application/pdf",
        dialogTitle: "Share Bill",
      });
    } else {
      throw new Error("Sharing not available on this device");
    }
  } catch (e) {
    throw e;
  }
}

export async function listBondedBluetoothDevices(): Promise<{ id: string; name: string }[]> {
  if (Platform.OS !== "android") return [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@haroldtran/react-native-thermal-printer");
    const ThermalPrinter = mod?.default ?? mod;
    if (ThermalPrinter?.getBluetoothDeviceList) {
      const list: { innerMacAddress: string; deviceName: string }[] =
        await ThermalPrinter.getBluetoothDeviceList();
      return list.map((d) => ({ id: d.innerMacAddress, name: d.deviceName }));
    }
  } catch {}
  return [];
}
