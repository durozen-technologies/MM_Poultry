import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import { PrinterDevice } from "../types/printer";

const PRINTER_KEY = "mmbroilers.printer";
const isWeb = Platform.OS === "web";

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

async function savePrinterSession(printer: PrinterDevice) {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (printer) ls.setItem(PRINTER_KEY, JSON.stringify(printer));
        return;
      } catch (e) {
        console.warn("Failed to save printer to localStorage", e);
      }
    }
  }
  try {
    if (printer) await SecureStore.setItemAsync(PRINTER_KEY, JSON.stringify(printer));
  } catch (e) {
    console.warn("Failed to save printer session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (printer) ls.setItem(PRINTER_KEY, JSON.stringify(printer));
      } catch {}
    }
  }
}

async function clearPrinterSession() {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(PRINTER_KEY);
        return;
      } catch (e) {
        console.warn("Failed to clear localStorage printer session", e);
      }
    }
  }
  try {
    await SecureStore.deleteItemAsync(PRINTER_KEY);
  } catch (e) {
    console.warn("Failed to clear printer session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(PRINTER_KEY);
      } catch {}
    }
  }
}

async function readPrinterSession(): Promise<PrinterDevice | null> {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        const raw = ls.getItem(PRINTER_KEY);
        return raw ? (JSON.parse(raw) as PrinterDevice) : null;
      } catch (e) {
        console.warn("Failed to read localStorage printer session", e);
      }
    }
  }
  try {
    const raw = await SecureStore.getItemAsync(PRINTER_KEY);
    return raw ? (JSON.parse(raw) as PrinterDevice) : null;
  } catch (e) {
    console.warn("Failed to read printer session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        const raw = ls.getItem(PRINTER_KEY);
        if (raw) return JSON.parse(raw) as PrinterDevice;
      } catch {}
    }
    return null;
  }
}

type PrinterState = {
  connectedPrinter: PrinterDevice | null;
  hydrated: boolean;
  setPrinter: (printer: PrinterDevice) => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  hydrate: () => Promise<void>;
};

export const usePrinterStore = create<PrinterState>((set) => ({
  connectedPrinter: null,
  hydrated: false,
  async hydrate() {
    const printer = await readPrinterSession();
    set({ connectedPrinter: printer, hydrated: true });
  },
  async setPrinter(printer: PrinterDevice) {
    await savePrinterSession(printer);
    set({ connectedPrinter: printer });
  },
  async disconnectPrinter() {
    await clearPrinterSession();
    set({ connectedPrinter: null });
  },
}));
