import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import { getMe, login as apiLogin } from "../api/auth";
import { setAuthToken, setOnUnauthorized } from "../api/client";
import { queryClient } from "../query-client";
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

const isWeb = Platform.OS === "web";

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

async function saveSession(token: string, user: User) {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (token) ls.setItem(TOKEN_KEY, String(token));
        if (user) ls.setItem(USER_KEY, JSON.stringify(user));
        return;
      } catch (e) {
        console.warn("Failed to save session to localStorage", e);
      }
    }
  }
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, String(token));
    if (user) await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn("Failed to save session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (token) ls.setItem(TOKEN_KEY, String(token));
        if (user) ls.setItem(USER_KEY, JSON.stringify(user));
      } catch {}
    }
  }
}

async function clearSession() {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(TOKEN_KEY);
        ls.removeItem(USER_KEY);
        return;
      } catch (e) {
        console.warn("Failed to clear localStorage session", e);
      }
    }
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (e) {
    console.warn("Failed to clear session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(TOKEN_KEY);
        ls.removeItem(USER_KEY);
      } catch {}
    }
  }
}

async function readSession(): Promise<{ token: string | null; user: User | null }> {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        const token = ls.getItem(TOKEN_KEY);
        const raw = ls.getItem(USER_KEY);
        return { token, user: raw ? (JSON.parse(raw) as User) : null };
      } catch (e) {
        console.warn("Failed to read localStorage session", e);
      }
    }
  }
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return { token, user: raw ? (JSON.parse(raw) as User) : null };
  } catch (e) {
    console.warn("Failed to read session", e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        const token = ls.getItem(TOKEN_KEY);
        const raw = ls.getItem(USER_KEY);
        if (token || raw) return { token, user: raw ? (JSON.parse(raw) as User) : null };
      } catch {}
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
        queryClient.clear();
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
    queryClient.clear();
  },
  async logout() {
    setAuthToken(null);
    await clearSession();
    queryClient.clear();
    set({ token: null, user: null });
  },
}));

useAuthStore.subscribe((state) => {
  setAuthToken(state.token);
});

setOnUnauthorized(() => {
  const { logout } = useAuthStore.getState();
  void logout();
});
