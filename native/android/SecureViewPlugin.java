package app.lovable.kob.secureview;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * SecureViewPlugin — toggles FLAG_SECURE on the host Activity window.
 *
 * When enabled:
 *   - Screenshots return a black image.
 *   - Screen recording (built-in or third-party) shows a black frame.
 *   - Screen mirroring / casting hides the window from the secondary display.
 *
 * Drop this file (or its Kotlin equivalent) into:
 *   android/app/src/main/java/app/lovable/kob/secureview/SecureViewPlugin.java
 *
 * Then register it in MainActivity.java:
 *   registerPlugin(SecureViewPlugin.class);
 */
@CapacitorPlugin(name = "SecureView")
public class SecureViewPlugin extends Plugin {

    private boolean enabled = false;

    @PluginMethod
    public void enable(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                getActivity().getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
                enabled = true;
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void disable(final PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                getActivity().getWindow().clearFlags(
                    WindowManager.LayoutParams.FLAG_SECURE
                );
                enabled = false;
                JSObject ret = new JSObject();
                ret.put("ok", true);
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void isEnabled(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }
}
