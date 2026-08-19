import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { getMe, login as apiLogin } from "../api/auth";
import { setAuthToken, setOnUnauthorized } from "../api/client";
import type { User } from "../types/api";

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
    const { token } = await readSession();
    if (token) {
      setAuthToken(token);
      try {
        const me = await getMe();
        await saveSession(token, me);
        set({ token, user: me, hydrated: true });
        return;
      } catch {
        setAuthToken(null);
        await clearSession();
        set({ token: null, user: null, hydrated: true });
        return;
      }
    }
    set({ token: null, user: null, hydrated: true });
  },
  async login(username, password, organizationSlug) {
    const data = await apiLogin(username, password, organizationSlug);
    setAuthToken(data.access_token);
    await saveSession(data.access_token, data.user);
    set({ token: data.access_token, user: data.user });
  },
  async logout() {
    setAuthToken(null);
    await clearSession();
    set({ token: null, user: null });
  },
}));

useAuthStore.subscribe((state) => {
  setAuthToken(state.token);
});

setOnUnauthorized(() => {
  void useAuthStore.getState().logout();
});

setAuthToken(useAuthStore.getState().token);
