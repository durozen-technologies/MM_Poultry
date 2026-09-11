import { create } from "zustand";
import { PrinterDevice, DeliveryReceiptData } from "../utils/printer";
import { readSecureItem, saveSecureItem, deleteSecureItem } from "../utils/storage";

type StartReceiptJob = (data: DeliveryReceiptData[], device: PrinterDevice) => Promise<void>;

const PRINTER_KEY = "mmbroilers.printer";

async function savePrinterSession(printer: PrinterDevice) {
  if (printer) await saveSecureItem(PRINTER_KEY, JSON.stringify(printer));
}

async function clearPrinterSession() {
  await deleteSecureItem(PRINTER_KEY);
}

async function readPrinterSession(): Promise<PrinterDevice | null> {
  const raw = await readSecureItem(PRINTER_KEY);
  return raw ? (JSON.parse(raw) as PrinterDevice) : null;
}

type PrinterState = {
  connectedPrinter: PrinterDevice | null;
  hydrated: boolean;
  startReceiptJob: StartReceiptJob | null;
  setPrinter: (printer: PrinterDevice) => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  hydrate: () => Promise<void>;
  setStartReceiptJob: (fn: StartReceiptJob | null) => void;
};

export const usePrinterStore = create<PrinterState>((set) => ({
  connectedPrinter: null,
  hydrated: false,
  startReceiptJob: null,
  setStartReceiptJob: (fn) => set({ startReceiptJob: fn }),
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
