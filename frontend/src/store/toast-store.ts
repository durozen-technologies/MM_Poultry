import { create } from "zustand";

interface ToastState {
  visible: boolean;
  title: string;
  subtitle?: string;
  showToast: (title: string, subtitle?: string) => void;
  hideToast: () => void;
}

let timeoutId: NodeJS.Timeout | null = null;

export const useToastStore = create<ToastState>((set) => ({
  visible: false,
  title: "",
  subtitle: undefined,
  showToast: (title, subtitle) => {
    set({ visible: true, title, subtitle });
    
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    
    timeoutId = setTimeout(() => {
      set({ visible: false });
    }, 3000);
  },
  hideToast: () => {
    set({ visible: false });
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }
}));
