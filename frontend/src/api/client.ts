import axios from "axios";
import { useAuthStore } from "../store/auth-store";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const message =
      error?.response?.data?.error?.message ||
      error?.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  }
);
