import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

/**
 * `true` on first client render, then tracks viewport changes.
 *
 * The original version returned `false` until an effect ran, which meant
 * server and first client render always agreed on "desktop" and then flipped
 * to mobile after hydration — a visible layout jump on every phone load.
 * Reading `matchMedia` lazily during the first render keeps them in sync.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  );
}
