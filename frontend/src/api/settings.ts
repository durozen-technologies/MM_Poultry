import { api } from "./client";

export type OrgSettings = {
  id: string;
  weight_loss_warn_pct: string;
  weight_loss_alert_pct: string;
  enforce_credit_limit: boolean;
};

export async function getOrgSettings(): Promise<OrgSettings> {
  const { data } = await api.get<OrgSettings>("/admin/settings");
  return data;
}

export async function updateOrgSettings(payload: Partial<OrgSettings>): Promise<OrgSettings> {
  const { data } = await api.put<OrgSettings>("/admin/settings", payload);
  return data;
}
