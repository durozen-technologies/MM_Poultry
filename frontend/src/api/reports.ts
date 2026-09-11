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


export async function downloadReportPdf(
  period: "daily" | "weekly" | "monthly",
  onDate: string | undefined
) {
  const params = new URLSearchParams({ period });
  if (onDate) params.set("on_date", onDate);
  const res = await api.get<ArrayBuffer>(`/admin/reports/summary.pdf`, {
    params: { period, on_date: onDate },
    responseType: "arraybuffer",
  });
  return res.data;
}
