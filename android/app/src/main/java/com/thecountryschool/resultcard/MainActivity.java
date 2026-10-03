package com.thecountryschool.resultcard;

import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "ResultCard";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);

        /**
         * Chromium kills the renderer process when the page exceeds its memory
         * budget, which is what the `SandboxedProcessService` / signal 9 entries
         * in logcat came from on this device (4 GB, and the renderer gets the
         * smallest slice of it).
         *
         * Capacitor forwards the platform callback to registered
         * `WebViewListener`s, and with none registered `BridgeWebViewClient`
         * returns false — meaning "the WebView is still usable" — so the app
         * stays up showing a dead, frozen window with no way out.
         *
         * Returning true marks it dead so Android tears the Activity down and
         * returns cleanly to the launcher; the next launch starts fresh rather
         * than resuming a dead renderer. The renderer's JS heap is a separate
         * process, so `android:largeHeap` cannot raise its ceiling and a fresh
         * WebView would need a whole new bridge, so restarting in place is not
         * an option.
         *
         * `RenderProcessGoneDetail` is API 26 and `minSdk` is 24, so the class
         * reference is fenced off to keep it off the pre-26 verifier's radar.
         */
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getBridge()
                    .addWebViewListener(
                            new WebViewListener() {
                                @Override
                                public boolean onRenderProcessGone(
                                        WebView webView, RenderProcessGoneDetail detail) {
                                    Log.e(TAG, "Renderer process gone (didCrash=" + detail.didCrash()
                                            + "); terminating Activity");
                                    return true;
                                }
                            });
        }
    }
}