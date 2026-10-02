package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;

/**
 * DER ARBEITER IM HINTERGRUND, von der Seite aus gestellt (0067).
 *
 * <code>
 *   configure(api, token, intervalMinutes, chats, forms, links, contents, reminders)
 *   stop()                 kein Arbeiter, kein Kennzeichen, keine Meldungen, kein Wecker
 *   seen(unread, forms, links, since, chats)   was die App gerade gezeigt hat
 *   status()
 *   present(news)          0076: Meldungen mit Inhalt (Notices)
 *   plan(reminders)        0076: der Wecker für Aufgaben (Reminders)
 *   dismiss(chatId)        0076: die Rozmowa ist offen — ihre Meldung weg
 *   Ereignis "check"       0075: ein Wecksignal kam, während die App vorn ist
 * </code>
 *
 * <p>Der Takt: {@link PeriodicWorkRequest} mit mindestens 15 Minuten (weniger
 * lässt Android nicht zu), nur mit Netz, nur bei nicht schwachem Akku. Doze
 * und App-Standby strecken ihn weiter — das ist gewollt.</p>
 */
@CapacitorPlugin(name = "Notify")
public class NotifyPlugin extends Plugin {

    private static final String WORK = "recreatio-notify";

    /** Die Brücke dieser App — damit ein Wecksignal die Seite erreicht, wenn sie vorn ist. */
    private static volatile NotifyPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    /**
     * 0075 — der Seite sagen, dass es Neues gibt (sie holt sofort und entscheidet,
     * was sie meldet). {@code false}: keine Seite da — dann meldet der Wecker selbst.
     */
    static boolean tellPage() {
        NotifyPlugin plugin = instance;
        if (plugin == null) return false;
        new Handler(Looper.getMainLooper()).post(() -> plugin.notifyListeners("check", new JSObject()));
        return true;
    }

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
                .putBoolean("contents", call.getBoolean("contents", true))
                .putBoolean("reminders", call.getBoolean("reminders", true))
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

        /* 0075 — der Wecker: Firebase, wenn die App damit gebaut ist; die Kennung geht dann an den Dienst. */
        boolean push = PushSetup.start(getContext());
        if (push) new Thread(() -> PushSetup.send(getContext())).start();
        JSObject out = new JSObject();
        out.put("push", push);
        call.resolve(out);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
        WorkManager.getInstance(getContext()).cancelUniqueWork(RichWork.WORK_CHECK);
        PushSetup.stop(getContext());
        /* 0076 — beim Abmelden: keine Inhalte mehr auf dem Bildschirm, kein Wecker, keine offene Seite im Hintergrund. */
        Notices.clearAll(getContext());
        Reminders.clear(getContext());
        RunnerHost.shutdown();
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

        /* 0076 — welche Rozmowy noch Ungelesenes haben; die Meldungen der übrigen gehen weg. */
        JSArray chats = call.getArray("chats");
        if (chats != null) {
            try {
                Set<String> unread = new HashSet<>();
                for (int i = 0; i < chats.length(); i++) unread.add(chats.getString(i));
                Notices.keepOnly(getContext(), unread);
            } catch (Exception ignored) {
                // Beim nächsten Mal.
            }
        }
        call.resolve();
    }

    /** 0076 — die Seite hat geöffnet, was neu ist; das Telefon zeigt es (und entscheidet, was klingelt). */
    @PluginMethod
    public void present(PluginCall call) {
        JSObject news = call.getObject("news");
        if (news == null) {
            call.reject("news is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                Notices.present(getContext(), new JSONObject(news.toString()));
                call.resolve();
            } catch (Exception e) {
                call.reject("present failed", e);
            }
        });
    }

    /** 0076 — die Erinnerungen in den Wecker des Telefons (ersetzt, was geplant war). */
    @PluginMethod
    public void plan(PluginCall call) {
        JSArray list = call.getArray("reminders");
        try {
            Reminders.plan(getContext(), list == null ? new JSONArray() : new JSONArray(list.toString()));
            prefs().edit().putLong("planAt", System.currentTimeMillis()).apply();
            call.resolve();
        } catch (Exception e) {
            call.reject("plan failed", e);
        }
    }

    /** 0076 — die Rozmowa ist offen: ihre Meldung weg. */
    @PluginMethod
    public void dismiss(PluginCall call) {
        String chatId = call.getString("chatId");
        if (chatId != null) {
            try {
                Notices.dismissChat(getContext(), chatId);
            } catch (Exception ignored) {
                // Nichts zu sehen.
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        out.put("configured", prefs().getString("token", null) != null);
        out.put("intervalMinutes", prefs().getInt("interval", 0));
        /* 0075 — kann Firebase (mit diesem Bau, auf diesem Telefon), und kam die Kennung beim Dienst an? */
        out.put("pushBuilt", PushSetup.ready(getContext()));
        out.put("push", PushSetup.active(getContext()));
        /* 0076 — Inhalt in den Meldungen, und wie der Läufer zuletzt ausging. */
        out.put("contents", prefs().getBoolean("contents", true));
        long richAt = prefs().getLong("richAt", 0);
        out.put("richAt", richAt == 0 ? null : Inbox.iso(richAt));
        out.put("richResult", prefs().getString("richResult", null));
        call.resolve(out);
    }
}
