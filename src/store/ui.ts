import { create } from "zustand";

/** Temporary UI state only. Persistent data lives in IndexedDB / Supabase. */
interface UIState {
  captureOpen: boolean;
  capturePrefill: string | null;
  expenseOpen: boolean;
  paletteOpen: boolean;
  notificationsOpen: boolean;
  liveMessage: string;
  openCapture: (prefill?: string) => void;
  closeCapture: () => void;
  openExpense: () => void;
  closeExpense: () => void;
  setPaletteOpen: (open: boolean) => void;
  setNotificationsOpen: (open: boolean) => void;
  announce: (message: string) => void;
}

export const useUI = create<UIState>((set) => ({
  captureOpen: false,
  capturePrefill: null,
  expenseOpen: false,
  paletteOpen: false,
  notificationsOpen: false,
  liveMessage: "",
  openCapture: (prefill) => set({ captureOpen: true, capturePrefill: prefill ?? null }),
  closeCapture: () => set({ captureOpen: false, capturePrefill: null }),
  openExpense: () => set({ expenseOpen: true }),
  closeExpense: () => set({ expenseOpen: false }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
  announce: (liveMessage) => set({ liveMessage }),
}));
