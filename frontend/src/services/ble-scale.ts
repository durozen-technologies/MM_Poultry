/**
 * Bluetooth scale helper.
 * On native Android with BLE permissions, integrate react-native-ble-plx.
 * Web/dev fallback lets operators enter weight manually after "simulate".
 */

export type ScaleReading = {
  kg: number;
  deviceId: string;
  source: "ble" | "manual" | "simulated";
};

let lastSimulated = 45 + Math.random() * 10;

export async function readScaleWeight(deviceId = "SIM-SCALE"): Promise<ScaleReading> {
  // Simulate stable-ish BLE packet for demo / web.
  lastSimulated = Math.round((lastSimulated + (Math.random() - 0.5) * 0.4) * 1000) / 1000;
  return {
    kg: lastSimulated,
    deviceId,
    source: "simulated",
  };
}

export function formatReceipt(lines: string[]): string {
  return lines.join("\n");
}
