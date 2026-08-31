/**
 * Offline queue — stores pending weigh/commit operations when network is unavailable
 * and replays them when connectivity returns.
 * Uses AsyncStorage when available, falls back to in-memory.
 */

type QueuedOp = {
  id: string;
  type: "weigh" | "commit" | "print-status" | "whatsapp";
  payload: Record<string, unknown>;
  stopId?: string;
  billId?: string;
  attempts: number;
  createdAt: string;
};

const MAX_ATTEMPTS = 3;
const STORAGE_KEY = "mm_poultry_offline_queue";

let memoryQueue: QueuedOp[] = [];

function getStorage(): { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const AsyncStorage = require("@react-native-async-storage/async-storage").default;
    if (AsyncStorage) return AsyncStorage;
  } catch {}
  return null;
}

export async function enqueue(op: Omit<QueuedOp, "id" | "attempts" | "createdAt">): Promise<void> {
  const item: QueuedOp = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  const storage = getStorage();
  if (storage) {
    const raw = await storage.getItem(STORAGE_KEY);
    const arr: QueuedOp[] = raw ? JSON.parse(raw) : [];
    arr.push(item);
    await storage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } else {
    memoryQueue.push(item);
  }
}

export async function dequeue(id: string): Promise<void> {
  const storage = getStorage();
  if (storage) {
    const raw = await storage.getItem(STORAGE_KEY);
    const arr: QueuedOp[] = raw ? JSON.parse(raw) : [];
    const filtered = arr.filter((x) => x.id !== id);
    await storage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } else {
    memoryQueue = memoryQueue.filter((x) => x.id !== id);
  }
}

export async function listQueued(): Promise<QueuedOp[]> {
  const storage = getStorage();
  if (storage) {
    const raw = await storage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }
  return [...memoryQueue];
}

export async function replay(
  handlers: {
    weigh?: (stopId: string, payload: any) => Promise<unknown>;
    commit?: (stopId: string, payload: any) => Promise<unknown>;
    printStatus?: (billId: string, status: string) => Promise<unknown>;
    whatsapp?: (billId: string) => Promise<unknown>;
  },
): Promise<{ succeeded: number; failed: number }> {
  const ops = await listQueued();
  let succeeded = 0;
  let failed = 0;
  for (const op of ops) {
    try {
      if (op.type === "weigh" && handlers.weigh && op.stopId) await handlers.weigh(op.stopId, op.payload);
      else if (op.type === "commit" && handlers.commit && op.stopId) await handlers.commit(op.stopId, op.payload);
      else if (op.type === "print-status" && handlers.printStatus && op.billId) await handlers.printStatus(op.billId, op.payload.status as string);
      else if (op.type === "whatsapp" && handlers.whatsapp && op.billId) await handlers.whatsapp(op.billId);
      else throw new Error("Unknown op type");
      await dequeue(op.id);
      succeeded += 1;
    } catch {
      op.attempts += 1;
      if (op.attempts >= MAX_ATTEMPTS) {
        await dequeue(op.id);
        failed += 1;
      } else {
        // update attempts
        const storage = getStorage();
        if (storage) {
          const raw = await storage.getItem(STORAGE_KEY);
          const arr: QueuedOp[] = raw ? JSON.parse(raw) : [];
          const idx = arr.findIndex((x) => x.id === op.id);
          if (idx >= 0) {
            arr[idx] = op;
            await storage.setItem(STORAGE_KEY, JSON.stringify(arr));
          }
        }
      }
    }
  }
  return { succeeded, failed };
}
