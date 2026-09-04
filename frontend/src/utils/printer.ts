import { AppState, NativeModules, PermissionsAndroid, Platform } from "react-native";
import {
  BLEPrinter,
  type IBLEPrinter,
  type PrinterImageOptions as NativePrinterImageOptions,
  type PrinterOptions as NativePrinterOptions,
} from "@haroldtran/react-native-thermal-printer";

import {
  PrinterDevice,
  PrinterSupportState,
  PrinterTransport,
} from "../types/printer";

type PrinterOptions = {
  beep?: boolean;
  cut?: boolean;
  tailingLine?: boolean;
  encoding?: string;
  onError?: (error: Error) => void;
};

export type PrinterRuntime = {
  init: () => Promise<void>;
  getDeviceList: () => Promise<PrinterDevice[]>;
  connect: (device: PrinterDevice) => Promise<void>;
  closeConn: () => Promise<void>;
  printBill: (text: string, options?: PrinterOptions) => Promise<void>;
  printImageBase64: (base64: string, options?: NativePrinterImageOptions & { isLastSlice?: boolean }) => Promise<void>;
};

export type DeliveryReceiptItem = {
  name: string;
  quantity: number;
  price: number;
  total: number;
};



export type DeliveryReceiptData = {
  receipt_number: string;
  date: string;

  agency_name?: string;
  agency_address?: string;
  agency_mobile?: string;

  buyer_name: string;
  buyer_address: string;
  buyer_phone?: string;

  receipt_type?: 'DELIVERY' | 'PAYMENT' | 'TEST';
  opening_balance: number;

  items: DeliveryReceiptItem[];

  total_bill: number;
  cash_collected: number;
  upi_collected: number;

  closing_balance: number;
  cylinder_balances?: { name: string; count: number; given?: number; taken?: number }[];
};

export function formatCurrency(amount: number) {
  return `Rs. ${amount.toFixed(2)}`;
}

function hasBluetoothModule() {
  return !!NativeModules.RNBLEPrinter;
}

function hasUsbModule() {
  return !!NativeModules.RNUSBPrinter;
}

function getThermalPrinterModule() {
  return { BLEPrinter };
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== "android") {
    return true;
  }
  
  if (Platform.Version >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return (
      results["android.permission.BLUETOOTH_SCAN"] === PermissionsAndroid.RESULTS.GRANTED &&
      results["android.permission.BLUETOOTH_CONNECT"] === PermissionsAndroid.RESULTS.GRANTED
    );
  }
  
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function normalizeBluetoothPrinter(
  device: { device_name: string; inner_mac_address: string }
): PrinterDevice {
  return {
    id: `bt_${device.inner_mac_address}`,
    transport: "bluetooth",
    name: device.device_name || "Unknown Printer",
    address: device.inner_mac_address,
  };
}

function dedupePrinters(printers: PrinterDevice[]): PrinterDevice[] {
  const seen = new Set<string>();
  return printers.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(String(error));
}

function isNoDeviceFound(error: unknown) {
  return String(error).includes("No Bluetooth Device Found");
}

function getPrintOptions(onError?: (error: Error) => void): NativePrinterOptions {
  return {
    beep: true,
    cut: true,
    tailingLine: false, // Prevents excessive paper rolling
    encoding: "UTF8",
    onError,
  };
}

function waitForPrintDispatch(
  dispatch: (options: NativePrinterOptions) => void,
  options: PrinterOptions = {},
  settleDelayMs = 400,
) {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    dispatch(
      getPrintOptions((error) => {
        if (settled) {
          return;
        }
        settled = true;
        options.onError?.(error);
        reject(toError(error));
      }),
    );

    setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    }, settleDelayMs);
  });
}

function getPrintImageOptions(onError?: (error: Error) => void): NativePrinterImageOptions {
  return {
    beep: true,
    cut: true,
    tailingLine: false,
    encoding: "UTF8",
    imageWidth: 380,
    align: "center",
    onError,
  };
}

function getPrintImageSliceOptions(
  index: number,
  total: number,
  onError?: (error: Error) => void,
): NativePrinterImageOptions {
  const isLastSlice = index === total - 1;

  return {
    ...getPrintImageOptions(onError),
    beep: isLastSlice,
    cut: isLastSlice,
    tailingLine: isLastSlice,
  };
}

function waitForImagePrintDispatch(
  dispatch: (options: NativePrinterOptions) => void,
  options: PrinterOptions = {},
  isLastSlice = false,
) {
  return waitForPrintDispatch(dispatch, options, isLastSlice ? 2000 : 1800);
}

function createBluetoothRuntime(): PrinterRuntime {
  return {
    init: () => BLEPrinter.init(),
    getDeviceList: async () => {
      try {
        const printers = await BLEPrinter.getDeviceList();
        return dedupePrinters(printers.map(normalizeBluetoothPrinter));
      } catch (error) {
        if (isNoDeviceFound(error)) {
          return [];
        }
        throw toError(error);
      }
    },
    connect: async (device) => {
      if (!device.address) {
        throw new Error("This Bluetooth printer is missing its device address.");
      }
      await BLEPrinter.connectPrinter(device.address);
    },
    closeConn: () => BLEPrinter.closeConn(),
    printBill: (text, options = {}) =>
      waitForPrintDispatch(
        (nativeOptions) => BLEPrinter.printBill(text, nativeOptions),
        options,
      ),
    printImageBase64: (base64, options = {}) =>
      waitForImagePrintDispatch(
        (nativeOptions) =>
          BLEPrinter.printImageBase64(base64, {
            ...getPrintImageOptions(nativeOptions.onError),
            ...options,
          }),
        options,
        options.isLastSlice
      ),
  };
}

async function ensureBluetoothPrinterReady() {
  if (Platform.OS !== "android") {
    throw new Error("Bluetooth receipt printing is currently available only on Android.");
  }
  if (!hasBluetoothModule()) {
    throw new Error("Bluetooth printer support needs an Android development build or release build.");
  }

  const permissionGranted = await requestBluetoothPermissions();
  if (!permissionGranted) {
    throw new Error("Bluetooth permissions were denied. Allow printer permissions and try again.");
  }

  const runtime = createBluetoothRuntime();
  try {
    await runtime.init();
  } catch (error) {
    throw toError(error);
  }
  return runtime;
}

async function getPrinterRuntime(device: PrinterDevice) {
  return ensureBluetoothPrinterReady();
}

async function closePrinterConnection(printer: PrinterRuntime) {
  try {
    await printer.closeConn();
  } catch {
    // Ignore errors when no session is open
  }
}

async function connectWithRetry(printer: PrinterRuntime, device: PrinterDevice) {
  try {
    await printer.connect(device);
  } catch (error) {
    await closePrinterConnection(printer);
    try {
      await printer.connect(device);
    } catch {
      throw toError(error);
    }
  }
}

type ActivePrinterSession = {
  device: PrinterDevice;
  runtime: PrinterRuntime;
};

let activePrinterSession: ActivePrinterSession | null = null;
let printerIdleTimer: NodeJS.Timeout | null = null;
let printerJobQueue: (() => Promise<void>)[] = [];
let isPrinting = false;

AppState.addEventListener("change", (nextAppState) => {
  if (nextAppState.match(/inactive|background/)) {
    if (activePrinterSession) {
      closePrinterConnection(activePrinterSession.runtime).catch(() => {});
      activePrinterSession = null;
    }
    if (printerIdleTimer) {
      clearTimeout(printerIdleTimer);
      printerIdleTimer = null;
    }
  }
});

async function processPrinterQueue() {
  if (isPrinting) {
    return;
  }

  const job = printerJobQueue.shift();
  if (!job) {
    if (!printerIdleTimer && activePrinterSession) {
      printerIdleTimer = setTimeout(() => {
        if (activePrinterSession) {
          closePrinterConnection(activePrinterSession.runtime).catch(() => {});
          activePrinterSession = null;
        }
        printerIdleTimer = null;
      }, 15000);
    }
    return;
  }

  isPrinting = true;
  if (printerIdleTimer) {
    clearTimeout(printerIdleTimer);
    printerIdleTimer = null;
  }

  try {
    await job();
  } catch (error) {
    console.error("Printer Job Error:", error);
  } finally {
    isPrinting = false;
    processPrinterQueue();
  }
}

function enqueuePrinterJob<T>(job: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    printerJobQueue.push(async () => {
      try {
        const result = await job();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processPrinterQueue();
  });
}

async function getOrCreatePrinterSession(device: PrinterDevice): Promise<PrinterRuntime> {
  if (activePrinterSession && activePrinterSession.device.id !== device.id) {
    await closePrinterConnection(activePrinterSession.runtime).catch(() => {});
    activePrinterSession = null;
  }

  if (!activePrinterSession) {
    const runtime = await getPrinterRuntime(device);
    await closePrinterConnection(runtime);
    await connectWithRetry(runtime, device);
    activePrinterSession = { device, runtime };
  }

  return activePrinterSession.runtime;
}

export function getPrinterSupportState(): PrinterSupportState {
  if (Platform.OS !== "android") {
    return {
      supported: false,
      bluetooth: false,
      usb: false,
      reason: "Direct Bluetooth and USB thermal printing are currently available only on Android.",
    };
  }
  const bluetooth = hasBluetoothModule();
  const usb = hasUsbModule();

  if (!bluetooth && !usb) {
    return {
      supported: false,
      bluetooth: false,
      usb: false,
      reason: "Printer support needs an Android development build or release build.",
    };
  }
  return { supported: true, bluetooth, usb };
}

export async function loadBluetoothPrinters() {
  const printer = await ensureBluetoothPrinterReady();
  return printer.getDeviceList();
}

export async function connectPrinterDevice(device: PrinterDevice) {
  return enqueuePrinterJob(async () => {
    await getOrCreatePrinterSession(device);
    return device;
  });
}

function getCommandText() {
  return {
    LEFT: "\x1B\x61\x00",
    CENTER: "\x1B\x61\x01",
    RIGHT: "\x1B\x61\x02",
    NORMAL: "\x1D\x21\x00",
    DOUBLE_SIZE: "\x1D\x21\x11",
    BOLD_ON: "\x1B\x45\x01",
    BOLD_OFF: "\x1B\x45\x00",
    DIVIDER: "--------------------------------",
  };
}

export async function printTestReceipt(device: PrinterDevice) {
  return enqueuePrinterJob(async () => {
    const printer = await getOrCreatePrinterSession(device);
    const COMMAND = getCommandText();

    const payload = [
      `${COMMAND.CENTER}${COMMAND.BOLD_ON}PRINTER CONNECTED${COMMAND.BOLD_OFF}`,
      `${COMMAND.LEFT}Name: ${device.name || "Unknown Printer"}`,
      device.address ? `Address: ${device.address}` : "",
      `Date & Time: ${new Date().toLocaleString()}`,
      COMMAND.DIVIDER,
      `${COMMAND.CENTER}${COMMAND.BOLD_ON}MM Broilers${COMMAND.BOLD_OFF}`,
      `${COMMAND.CENTER}Printer Test Successful`,
      COMMAND.DIVIDER,
      `${COMMAND.LEFT}                    ${COMMAND.BOLD_ON}Thank You${COMMAND.BOLD_OFF}`,
      "            Software Provided By",
      "       Durozen Technologies Pvt. Ltd.",
      "",
      "",
    ]
      .filter(Boolean)
      .join("\n");

    await printer.printBill(payload);
  });
}

export async function printText(device: PrinterDevice, text: string) {
  return enqueuePrinterJob(async () => {
    const printer = await getOrCreatePrinterSession(device);
    await printer.printBill(text);
  });
}

export async function printReceiptImageBase64WithPrinter(base64Chunks: string[], device: PrinterDevice) {
  if (base64Chunks.length === 0) return;
  return enqueuePrinterJob(async () => {
    const printer = await getOrCreatePrinterSession(device);
    for (let index = 0; index < base64Chunks.length; index += 1) {
      const base64Chunk = base64Chunks[index];
      const isLastSlice = index === base64Chunks.length - 1;
      await printer.printImageBase64(base64Chunk, { ...getPrintImageSliceOptions(index, base64Chunks.length), isLastSlice });
    }
  });
}
