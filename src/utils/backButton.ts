import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

export type BackAction = () => boolean; // returns true if event was consumed

const handlers: BackAction[] = [];

/**
 * Register a scoped hardware back button handler (e.g. for closing an active modal or drawer).
 * Handlers are evaluated in LIFO (last-in, first-out) order.
 * Returns an unregister function.
 */
export function registerBackHandler(handler: BackAction): () => void {
  handlers.push(handler);
  return () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) {
      handlers.splice(idx, 1);
    }
  };
}

export interface HardwareBackButtonOptions {
  getCurrentPath: () => string;
  onNavigateHome: () => void;
  onShowToast: (message: string) => void;
}

let activeOptions: HardwareBackButtonOptions | null = null;
let lastBackPress = 0;
let isInitialized = false;

/**
 * Initialize global Android hardware back button handling.
 *
 * Behavior:
 * 1. Checks any registered modal/drawer dismiss handlers (LIFO).
 * 2. Checks if any DOM dialog or sheet element is open.
 * 3. If currently on a sub-route (e.g. /editor/... or /settings), navigates back to Home (/),
 * 4. If already on Home (/), requires a second back press within 2000ms to exit the application.
 */
export function initHardwareBackButton(options: HardwareBackButtonOptions): () => void {
  activeOptions = options;

  if (!isInitialized && Capacitor.isNativePlatform()) {
    isInitialized = true;

    CapApp.addListener("backButton", () => {
      // 1. Run top-most custom registered handler
      for (let i = handlers.length - 1; i >= 0; i--) {
        try {
          const handler = handlers[i];
          if (!handler) continue;
          const consumed = handler();
          if (consumed) return;
        } catch (err) {
          console.error("Back handler error:", err);
        }
      }

      // 2. Check for open Radix / Vaul dialogs or drawers in DOM
      const openDialog = document.querySelector(
        '[role="dialog"], [data-state="open"][data-radix-portal], [data-vaul-drawer]',
      );
      if (openDialog) {
        const esc = new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        });
        document.dispatchEvent(esc);
        return;
      }

      // 3. Determine if current location is Home
      if (!activeOptions) return;
      const path = activeOptions.getCurrentPath();
      const hash = window.location.hash || "";
      const isHome =
        path === "/" ||
        path === "" ||
        hash === "#/" ||
        hash === "#" ||
        hash === "";

      if (!isHome) {
        activeOptions.onNavigateHome();
        return;
      }

      // 4. Home screen double-back to exit
      const now = Date.now();
      if (now - lastBackPress < 2000) {
        CapApp.exitApp();
      } else {
        lastBackPress = now;
        activeOptions.onShowToast("Press back again to exit");
      }
    });
  }

  return () => {
    // listener remains active with updated activeOptions
  };
}
