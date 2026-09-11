import { create } from "zustand";
import { getMe, login as apiLogin } from "../api/auth";
import { setAuthToken, setOnUnauthorized } from "../api/client";
import { queryClient } from "../lib/query-client";
import type { User } from "../types/api";
import { readSecureItem, saveSecureItem, deleteSecureItem } from "../utils/storage";

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
  if (token) await saveSecureItem(TOKEN_KEY, String(token));
  if (user) await saveSecureItem(USER_KEY, JSON.stringify(user));
}

async function clearSession() {
  await deleteSecureItem(TOKEN_KEY);
  await deleteSecureItem(USER_KEY);
}

async function readSession(): Promise<{ token: string | null; user: User | null }> {
  const token = await readSecureItem(TOKEN_KEY);
  const raw = await readSecureItem(USER_KEY);
  return { token, user: raw ? (JSON.parse(raw) as User) : null };
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
