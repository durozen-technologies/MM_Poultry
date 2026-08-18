import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { api } from "../api/client";
import type { LoginResponse, User } from "../types/api";

const TOKEN_KEY = "mmbroilers.token";
const USER_KEY = "mmbroilers.user";

type AuthState = {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  login: (username: string, password: string, organizationSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
};

async function saveSession(token: string, user: User) {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch {
    // web fallback
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }
}

async function clearSession() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
}

async function readSession(): Promise<{ token: string | null; user: User | null }> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return { token, user: raw ? (JSON.parse(raw) as User) : null };
  } catch {
    if (typeof localStorage !== "undefined") {
      const token = localStorage.getItem(TOKEN_KEY);
      const raw = localStorage.getItem(USER_KEY);
      return { token, user: raw ? (JSON.parse(raw) as User) : null };
    }
    return { token: null, user: null };
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  async hydrate() {
    const { token, user } = await readSession();
    set({ token, user, hydrated: true });
  },
  async login(username, password, organizationSlug) {
    const { data } = await api.post<LoginResponse>("/auth/login", {
      username,
      password,
      organization_slug: organizationSlug || null,
    });
    await saveSession(data.access_token, data.user);
    set({ token: data.access_token, user: data.user });
  },
  async logout() {
    await clearSession();
    set({ token: null, user: null });
  },
}));

// Bind the store to the API client to avoid require cycles
import { setAuthToken, setOnUnauthorized } from "../api/client";

useAuthStore.subscribe((state) => {
  setAuthToken(state.token);
});

setOnUnauthorized(() => {
  useAuthStore.getState().logout();
});

// Initial binding
setAuthToken(useAuthStore.getState().token);
