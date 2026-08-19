import axios, { isAxiosError } from "axios";
import { Platform } from "react-native";

function defaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
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
});

let authToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const setOnUnauthorized = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

/** Backend returns { error: { code, message } }; FastAPI validation uses { detail }. */
export function getApiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object") {
      const envelope = data as { error?: { message?: string }; detail?: unknown };
      if (envelope.error?.message) {
        return envelope.error.message;
      }
      if (typeof envelope.detail === "string") {
        return envelope.detail;
      }
      if (envelope.detail !== undefined) {
        return JSON.stringify(envelope.detail);
      }
    }
    if (error.message === "Network Error") {
      return `Cannot reach API at ${API_BASE_URL}. Check backend is running and EXPO_PUBLIC_API_BASE_URL.`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    return Promise.reject(new Error(getApiErrorMessage(error)));
  }
);
