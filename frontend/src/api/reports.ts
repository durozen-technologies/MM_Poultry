import { API_BASE_URL, api } from "./client";
import type { ReportSummary, TripWeightLoss } from "../types/api";

export async function getReportSummary(period: "daily" | "weekly" | "monthly", onDate?: string) {
  const { data } = await api.get<ReportSummary>("/admin/reports/summary", {
    params: { period, on_date: onDate },
  });
  return data;
}

export async function getTripWeightLoss(runId: string) {
  const { data } = await api.get<TripWeightLoss | null>(`/admin/trips/${runId}/weight-loss`);
  return data;
}

export function reportPdfUrl(period: string, onDate: string | undefined) {
  const params = new URLSearchParams({ period });
  if (onDate) params.set("on_date", onDate);
  return `${API_BASE_URL}/api/v1/admin/reports/summary.pdf?${params.toString()}`;
}

export async function downloadReportPdf(
  period: "daily" | "weekly" | "monthly",
  onDate: string | undefined,
  token: string
) {
  const params = new URLSearchParams({ period });
  if (onDate) params.set("on_date", onDate);
  const res = await fetch(`${API_BASE_URL}/api/v1/admin/reports/summary.pdf?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to download report PDF");
  return res.arrayBuffer();
}
