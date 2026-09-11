import { DeliveryStop } from "../types/api";

export function buildWeighPayload(
  activeStop: DeliveryStop,
  weights: Record<string, string>,
  skipScale?: boolean
) {
  const itemsPayload = (activeStop.items || []).map((item) => {
    const inputWeight = weights[item.item_id];
    const weight = Number(inputWeight || item.ordered_kg || "0");
    const boxes = Number(item.delivered_boxes ?? item.original_total_boxes ?? "1");

    if (weight <= 0) throw new Error(`Weight must be > 0 for ${item.item_id.slice(0, 8)}`);

    return {
      item_id: item.item_id,
      weight_kg: weight,
      delivered_boxes: boxes,
      delivered_bird_count: 0,
    };
  });

  return {
    scale_device_id: skipScale ? "MANUAL" : "BLE-SCALE",
    items: itemsPayload,
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (e: any) => boolean = (e) => {
    const code = e?.response?.status;
    return code === 503 || code === 429;
  },
  retries = 1,
  delayMs = 800
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e: any) {
      if (shouldRetry(e) && attempt < retries) {
        attempt++;
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
}

export async function safeWeighStop(
  weighStopFn: (id: string, payload: any) => Promise<any>,
  stopId: string,
  payload: any
) {
  return await withRetry(
    async () => {
      try {
        return await weighStopFn(stopId, payload);
      } catch (e: any) {
        const code = e?.response?.status;
        if (code === 409 && String(e?.message || "").includes("WEIGH")) {
          return null; // Already weighed, treat as success
        }
        throw e;
      }
    }
  );
}

export async function safeCommitBill(
  commitBillFn: (id: string, payload: any) => Promise<any>,
  stopId: string,
  payload: any
) {
  return await withRetry(() => commitBillFn(stopId, payload));
}
