import axios, { isAxiosError } from "axios";
import { Platform } from "react-native";

function defaultApiBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (raw) {
    const normalized = raw.replace(/\/+$/, "");
    if (
      process.env.NODE_ENV === "production" &&
      normalized.startsWith("http://") &&
      !normalized.includes("127.0.0.1") &&
      !normalized.includes("10.0.2.2") &&
      !normalized.includes("localhost")
    ) {
      console.warn("EXPO_PUBLIC_API_BASE_URL should use https in production:", normalized);
    }
    return normalized;
  }
  // ponytail: Android emulator maps host loopback to 10.0.2.2; physical device needs EXPO_PUBLIC_API_BASE_URL
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return "http://127.0.0.1:8000";
}

export const API_BASE_URL = defaultApiBaseUrl();

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 20000,
  headers: { "X-Client": "mm-poultry-mobile" },
});

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setOnUnauthorized = (callback: (() => void) | null) => {
  onUnauthorizedCallback = callback;
};

/** Extract human-readable message from Axios / backend envelope. */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data && typeof data === "object") {
      // Production envelope: { error: { code, message, details } }
      if (data.error?.message) {
        const details = data.error.details;
        if (Array.isArray(details) && details.length > 0) {
          const first = details[0] as { msg?: string; loc?: string[] };
          const loc = first.loc ? ` (${first.loc.join(".")})` : "";
          return `${data.error.message}${loc}: ${first.msg || JSON.stringify(first)}`;
        }
        if (typeof details === "string") return `${data.error.message}: ${details}`;
        return data.error.message;
      }
      // Fallback FastAPI validation: { detail: [...] } (should be normalized by backend)
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail)) {
        const first = data.detail[0] as { msg?: string; loc?: string[] };
        const loc = first.loc ? ` (${first.loc.join(".")})` : "";
        return `Validation failed${loc}: ${first.msg || JSON.stringify(first)}`;
      }
      if (data.detail !== undefined) return JSON.stringify(data.detail);
    }
    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      return "Unable to connect to server. Please check your internet connection and try again.";
    }
    if (error.code === "ECONNABORTED") return "Request timed out. Check your connection.";
    if (error.response?.status === 429) return "Too many requests. Please wait and retry.";
    if (error.response?.status === 503) return "Service temporarily unavailable. Please retry.";
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export function getApiErrorCode(error: unknown): string | null {
  if (isAxiosError(error)) {
    const data = error.response?.data as any;
    if (data?.error?.code) return data.error.code as string;
    if (error.response?.status === 401) return "UNAUTHORIZED";
    if (error.response?.status === 403) return "FORBIDDEN";
    if (error.response?.status === 404) return "NOT_FOUND";
    if (error.response?.status === 409) return "CONFLICT";
    if (error.response?.status === 422) return "VALIDATION_ERROR";
  }
  return null;
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  // Attach request ID for tracing (backend echoes via X-Request-ID)
  if (!config.headers["X-Request-ID"]) {
    (config.headers as Record<string, string>)["X-Request-ID"] = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  // X-Organization-Slug for tenant routing when available
  try {
    // Lazy import to avoid circular dependency at module load
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore } = require("../store/auth-store");
    const slug: string | null | undefined = useAuthStore?.getState?.()?.user?.organization_slug;
    if (slug) {
      (config.headers as Record<string, string>)["X-Organization-Slug"] = slug;
    }
  } catch {
    // ignore if store not ready
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    if (isAxiosError(error)) {
      (error as unknown as Record<string, unknown>).apiMessage = getApiErrorMessage(error);
      error.message = getApiErrorMessage(error);
    } else if (error instanceof Error) {
      (error as unknown as Record<string, unknown>).apiMessage = getApiErrorMessage(error);
    }
    return Promise.reject(error);
  }
);
