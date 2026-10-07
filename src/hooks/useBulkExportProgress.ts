import { useSyncExternalStore } from "react";
import type { PdfPhase } from "@/utils/pdf";

export interface BulkExportProgressState {
  isOpen: boolean;
  phase: PdfPhase;
  current: number;
  total: number;
  percent: number;
  label: string;
  studentName?: string;
  isCancelling: boolean;
}

const initialState: BulkExportProgressState = {
  isOpen: false,
  phase: "rendering",
  current: 0,
  total: 0,
  percent: 0,
  label: "",
  studentName: undefined,
  isCancelling: false,
};

let currentState: BulkExportProgressState = initialState;
const listeners = new Set<() => void>();

export const bulkExportStore = {
  getState(): BulkExportProgressState {
    return currentState;
  },
  setState(
    updater:
      | Partial<BulkExportProgressState>
      | ((prev: BulkExportProgressState) => BulkExportProgressState),
  ) {
    const next =
      typeof updater === "function"
        ? updater(currentState)
        : { ...currentState, ...updater };
    currentState = next;
    listeners.forEach((l) => l());
  },
  reset() {
    currentState = initialState;
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function useBulkExportProgress(): BulkExportProgressState {
  return useSyncExternalStore(
    bulkExportStore.subscribe,
    bulkExportStore.getState,
    () => initialState,
  );
}
