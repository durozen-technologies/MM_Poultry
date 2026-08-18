import axios from "axios";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

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
    
    // Extract FastAPI detailed error messages
    if (error.response?.data?.detail) {
      const msg = typeof error.response.data.detail === 'string' 
        ? error.response.data.detail 
        : JSON.stringify(error.response.data.detail);
      return Promise.reject(new Error(msg));
    }
    
    return Promise.reject(error);
  }
);
