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
