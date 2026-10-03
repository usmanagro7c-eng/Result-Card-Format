import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

declare const __IS_MOBILE_APP__: boolean | undefined;

export const getRouter = () => {
  const queryClient = new QueryClient();

  const isNativeApp =
    (typeof __IS_MOBILE_APP__ !== "undefined" && Boolean(__IS_MOBILE_APP__)) ||
    (typeof window !== "undefined" &&
      (window.location.protocol === "file:" ||
        Boolean((window as any).Capacitor?.isNativePlatform?.())));

  const history = isNativeApp ? createHashHistory() : undefined;

  const router = createRouter({
    routeTree,
    history,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
