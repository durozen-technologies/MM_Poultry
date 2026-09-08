import type { DeliveryReceiptData } from "../utils/printer";
import type { PrinterDevice } from "../types/printer";

type StartReceiptJob = (data: DeliveryReceiptData[], device: PrinterDevice) => Promise<void>;

let startReceiptImagePrintJob: StartReceiptJob | null = null;

export function registerReceiptImagePrintJob(fn: StartReceiptJob | null) {
  startReceiptImagePrintJob = fn;
}

export async function runReceiptImagePrintJob(
  data: DeliveryReceiptData[],
  device: PrinterDevice
): Promise<void> {
  if (!startReceiptImagePrintJob) {
    throw new Error("Receipt printer is not ready. Restart the app and try again.");
  }
  await startReceiptImagePrintJob(data, device);
}
