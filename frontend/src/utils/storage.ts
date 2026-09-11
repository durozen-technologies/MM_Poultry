import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

function getLocalStorage(): Storage | null {
  try {
    if (typeof localStorage !== "undefined") return localStorage;
  } catch {
    return null;
  }
  return null;
}

export async function saveSecureItem(key: string, value: string) {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (value) ls.setItem(key, value);
        return;
      } catch (e) {
        console.warn(`Failed to save ${key} to localStorage`, e);
      }
    }
  }
  try {
    if (value) await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn(`Failed to save ${key} session`, e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        if (value) ls.setItem(key, value);
      } catch {}
    }
  }
}

export async function deleteSecureItem(key: string) {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(key);
        return;
      } catch (e) {
        console.warn(`Failed to clear ${key} from localStorage`, e);
      }
    }
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn(`Failed to clear ${key} session`, e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        ls.removeItem(key);
      } catch {}
    }
  }
}

export async function readSecureItem(key: string): Promise<string | null> {
  if (isWeb) {
    const ls = getLocalStorage();
    if (ls) {
      try {
        return ls.getItem(key);
      } catch (e) {
        console.warn(`Failed to read ${key} from localStorage`, e);
      }
    }
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch (e) {
    console.warn(`Failed to read ${key} session`, e);
    const ls = getLocalStorage();
    if (ls) {
      try {
        return ls.getItem(key);
      } catch {}
    }
    return null;
  }
}
