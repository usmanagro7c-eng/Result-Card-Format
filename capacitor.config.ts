import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.thecountryschool.resultcard",
  appName: "TCS Result Card",
  webDir: "dist-mobile",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    /**
     * Transparent WebView background.
     *
     * The WebView otherwise paints opaque white the moment it exists, which is
     * before the document has parsed, so the launch ran
     * launcher -> blank white -> logo splash. That white gap is the "double
     * splash": a blank stage, then the branded one.
     *
     * With it transparent the window background shows through instead, and that
     * background is already the branded splash (res/drawable/splash_window.xml -
     * white, TCS lockup, loading bar). So the launch becomes one continuous
     * branded screen: window background -> #boot overlay -> app, with nothing
     * blank in between.
     *
     * Only the pre-layout window is affected. mobile/index.html puts an opaque
     * bg-slate-50 on <body> in the initial markup, so once the document renders,
     * the window background is fully covered and cannot show through.
     */
    backgroundColor: "#f8fafc",
  },
  plugins: {
    SystemBars: {
      /**
       * The built-in plugin defaults to `"css"`, which pushes
       * `--safe-area-inset-*` onto `document.documentElement` from the native
       * side and throws when the document element is not parsed yet. Nothing in
       * this app reads those custom properties: `mobile/index.html` and the app
       * CSS both use native `env(safe-area-inset-*)`, which the WebView already
       * resolves. So the injection is redundant, and dropping it also removes a
       * post-paint style write on a low-end device.
       */
      insetsHandling: "disable",
    },
  },
};

export default config;
