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

/**
 * Reveal the React app smoothly once the initial route is ready.
 *
 * During startup:
 * 1. Android Activity paints the native starting window (splash_window.xml: pure white + TCS logo).
 * 2. Capacitor's WebView is transparent (backgroundColor: #00000000).
 * 3. html and body are transparent, and #root starts at opacity: 0.
 *
 * The user sees ONLY the single native splash screen from the moment they tap the icon.
 * There is NO web splash overlay, NO second logo, NO moving bar, and ZERO flicker.
 *
 * Once the router renders the initial route, #root smoothly fades in over 350ms.
 */
function revealApp() {
  const root = document.getElementById("root");
  if (!root) return;

  const MIN_SPLASH_MS = 500; // Snappy yet polished brand presentation time
  const startTime = performance.now();

  const show = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("app-ready");
        window.setTimeout(() => {
          document.body.classList.add("app-ready");
          root.style.willChange = "auto";
        }, 240);
      });
    });
  };

  const afterPaint = () => {
    const elapsed = performance.now() - startTime;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
    window.setTimeout(show, remaining);
  };

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    afterPaint();
  };

  if (router.state.status !== "idle") {
    finish();
  } else {
    const unsubscribe = router.subscribe("onRendered", () => {
      unsubscribe();
      finish();
    });
  }

  // Backstop: never leave the user waiting if router fails to emit onRendered
  window.setTimeout(finish, 3500);
}

revealApp();
