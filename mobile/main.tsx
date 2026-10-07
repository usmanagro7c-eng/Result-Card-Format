import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "@/router";
import "@/styles.css";

const router = getRouter();

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}

declare global {
  interface Window {
    NativeSplash?: {
      dismissSplash: () => void;
    };
  }
}

/**
 * Dismiss the native Android splash overlay once the app has mounted and rendered.
 *
 * The Android Activity maintains a native view overlay with R.drawable.splash_window
 * from the instant of cold start.
 * Once TanStack Router renders the initial route, this triggers a native 350ms
 * hardware-accelerated fade out on the Android UI thread.
 */
function initSplashDismissal() {
  const MIN_SPLASH_MS = 750; // Stable, premium brand presentation time
  const startTime = performance.now();

  const dismiss = () => {
    // Two requestAnimationFrames guarantee the DOM layout and paints have reached the compositor
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.NativeSplash?.dismissSplash();
      });
    });
  };

  const scheduleDismiss = () => {
    const elapsed = performance.now() - startTime;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    window.setTimeout(dismiss, remaining);
  };

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    scheduleDismiss();
  };

  const unsubscribe = router.subscribe("onRendered", () => {
    unsubscribe();
    finish();
  });

  // Backstop: ensure splash always dismisses within 3 seconds
  window.setTimeout(finish, 3000);
}

initSplashDismissal();
