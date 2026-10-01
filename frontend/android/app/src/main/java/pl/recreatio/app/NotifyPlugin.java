package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

/**
 * DER ARBEITER IM HINTERGRUND, von der Seite aus gestellt (0067).
 *
 * <code>
 *   configure(api, token, intervalMinutes, chats, forms, links)
 *   stop()                 kein Arbeiter, kein Kennzeichen
 *   seen(unread, forms, links, since)   was die App gerade gezeigt hat
 *   status()
 * </code>
 *
 * <p>Der Takt: {@link PeriodicWorkRequest} mit mindestens 15 Minuten (weniger
 * lässt Android nicht zu), nur mit Netz, nur bei nicht schwachem Akku. Doze
 * und App-Standby strecken ihn weiter — das ist gewollt.</p>
 */
@CapacitorPlugin(name = "Notify")
public class NotifyPlugin extends Plugin {

    private static final String WORK = "recreatio-notify";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(NotifyWorker.PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        String api = call.getString("api");
        String token = call.getString("token");
        if (api == null || token == null) {
            call.reject("api and token are required");
            return;
        }

        int minutes = Math.max(15, call.getInt("intervalMinutes", 30));
        prefs().edit()
                .putString("api", api)
                .putString("token", token)
                .putInt("interval", minutes)
                .putBoolean("chats", call.getBoolean("chats", true))
                .putBoolean("forms", call.getBoolean("forms", true))
                .putBoolean("links", call.getBoolean("links", true))
                .apply();

        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .setRequiresBatteryNotLow(true)
                .build();

        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(NotifyWorker.class, minutes, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
                .build();

        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.UPDATE, request);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
        prefs().edit().clear().apply();
        call.resolve();
    }

    @PluginMethod
    public void seen(PluginCall call) {
        prefs().edit()
                .putInt("seenLoud", call.getInt("unread", 0))
                .putInt("seenForms", call.getInt("forms", 0))
                .putInt("seenLinks", call.getInt("links", 0))
                .putString("since", call.getString("since", ""))
                .apply();
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        out.put("configured", prefs().getString("token", null) != null);
        out.put("intervalMinutes", prefs().getInt("interval", 0));
        call.resolve(out);
    }
}
