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
 * Take down the HTML launch overlay once the app has something to show.
 *
 * The native starting window only lasts until the WebView paints its first frame,
 * and that first frame is this overlay (see #boot in mobile/index.html), not the
 * React app. Without this the branded overlay would sit on top of a working app
 * forever, because nothing else removes it.
 *
 * `onRendered` fires after the router commits a render; the two animation frames
 * wait for that paint to reach the compositor so the overlay is never swapped for
 * an empty frame. A timeout backstop means a router that never reports still
 * reveals the app rather than leaving the user on a splash.
 */
function dismissBootOverlay() {
  const overlay = document.getElementById("boot");
  if (!overlay) return;

  const hide = () => {
    overlay.classList.add("boot--done");
    // Remove after the fade so it can never intercept taps on the app.
    window.setTimeout(() => overlay.remove(), 320);
  };

  const afterPaint = () => requestAnimationFrame(() => requestAnimationFrame(hide));

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

  // Backstop: never leave the user staring at a splash because the router
  // reported nothing.
  window.setTimeout(finish, 4000);
}

void dismissBootOverlay();
