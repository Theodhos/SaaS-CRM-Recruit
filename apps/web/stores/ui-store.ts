import { create } from 'zustand';

/**
 * Reference implementation of the stores/* pattern (zustand): client-only UI
 * state that doesn't belong in TanStack Query (which owns server state).
 * Add sibling stores as needed — most feature state should stay in
 * TanStack Query or component state instead of growing this file.
 */
interface UiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));
