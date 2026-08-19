import { api } from "./client";
import type { LoginResponse, User } from "../types/api";

export async function login(username: string, password: string, organizationSlug?: string) {
  const { data } = await api.post<LoginResponse>("/auth/login", {
    username,
    password,
    organization_slug: organizationSlug || null,
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get<User>("/auth/me");
  return data;
}

export async function checkUsername(username: string) {
  const { data } = await api.get<{ available: boolean }>("/auth/check-username", {
    params: { username },
  });
  return data;
}
