package pl.recreatio.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * SPÄTER SENDEN (2026-10-18) — geplante SMS dieses Telefons: auf dem Telefon geplant
 * („Wyślij później") oder im Browser geschrieben und von hier übernommen (0116).
 *
 * <code>
 *   scheduled   wartet auf seine Zeit (ein Wecker steht)
 *   sending     hinaus — das Netz hat noch nicht geantwortet
 *   sent        gesendet          failed   nicht gesendet
 * </code>
 *
 * <p>Sie liegen im Telefon, nicht im Netz: zur Zeit sendet {@link ScheduledReceiver}
 * sie auch ohne Verbindung. Was aus dem Browser kam, meldet danach der Läufer dem
 * Dienst. Der Wecker ist genau, wo das Telefon es erlaubt (USE_EXACT_ALARM), sonst
 * kommt er ein paar Minuten später.</p>
 */
final class ScheduledSms {

    static final String ACTION = "pl.recreatio.app.SEND_SCHEDULED";
    private static final String PREFS = "recreatio.scheduled";
    private static final String TAG = "recreatio";

    private ScheduledSms() {
    }

    private static JSONArray read(Context context) {
        try {
            return new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("all", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static void write(Context context, JSONArray all) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("all", all.toString()).apply();
    }

    /**
     * Alle — mit dem Stand, der aus dem Speicher der SMS folgt (gesendet / nicht gesendet).
     * Eigene (ohne Browser dahinter), die hinaus sind, fallen weg: ab dann steht die SMS selbst
     * im Gespräch, auch als „nie wysłano". Nur eine, die gar nicht erst hinausging, bleibt.
     */
    static synchronized JSONArray all(Context context) throws JSONException {
        JSONArray all = read(context);
        JSONArray kept = new JSONArray();
        boolean changed = false;
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.getJSONObject(i);
            if ("sending".equals(e.optString("state"))) {
                String outcome = outcome(context, e.optJSONArray("rows"));
                if (!"sending".equals(outcome)) {
                    e.put("state", outcome).put("doneAt", System.currentTimeMillis());
                    changed = true;
                }
            }
            String state = e.optString("state");
            JSONArray rows = e.optJSONArray("rows");
            if (!e.has("outboxId") && ("sent".equals(state) || ("failed".equals(state) && rows != null && rows.length() > 0))) {
                changed = true;
                continue;
            }
            kept.put(e);
        }
        if (changed) write(context, kept);
        return kept;
    }

    /** Wie die SMS im Speicher stehen: alle gesendet (2), eine nicht (5) — oder noch unterwegs. */
    private static String outcome(Context context, JSONArray rows) {
        if (rows == null || rows.length() == 0) return "failed";
        boolean all = true;
        for (int i = 0; i < rows.length(); i++) {
            int type = -1;
            try (Cursor c = context.getContentResolver().query(Uri.parse(rows.optString(i)), new String[] { "type" }, null, null, null)) {
                if (c != null && c.moveToFirst()) type = c.getInt(0);
            } catch (RuntimeException ignored) {
                type = -1;
            }
            if (type == 5) return "failed";
            if (type != 2) all = false;
        }
        return all ? "sent" : "sending";
    }

    /**
     * Eine planen — {@code id} (fehlt: neu), {@code to}, {@code body}, {@code sendAt} (ms; fehlt
     * oder vorbei: gleich), {@code subId}, für eine aus dem Browser {@code outboxArea}/{@code outboxId}.
     */
    static synchronized JSONObject add(Context context, JSONObject in) throws JSONException {
        JSONArray to = in.optJSONArray("to");
        String body = in.optString("body", "");
        if (to == null || to.length() == 0) throw new IllegalArgumentException("Brak odbiorcy.");
        if (body.trim().isEmpty()) throw new IllegalArgumentException("Pusta wiadomość.");
        String id = in.optString("id", "");
        if (id.isEmpty()) id = UUID.randomUUID().toString();
        Set<String> people = new LinkedHashSet<>();
        for (int i = 0; i < to.length(); i++) if (!to.optString(i, "").trim().isEmpty()) people.add(to.optString(i).trim());
        long thread = SmsStore.threadFor(context, people);
        JSONObject entry = new JSONObject()
                .put("id", id)
                .put("to", new JSONArray(people))
                .put("body", body)
                .put("sendAt", Math.max(System.currentTimeMillis(), in.optLong("sendAt", System.currentTimeMillis())))
                .put("subId", in.optInt("subId", -1))
                .put("threadId", String.valueOf(thread))
                .put("state", "scheduled")
                .put("rows", new JSONArray())
                .put("createdAt", System.currentTimeMillis());
        if (!in.isNull("outboxArea") && !in.optString("outboxArea", "").isEmpty()) {
            entry.put("outboxArea", in.optString("outboxArea")).put("outboxId", in.optString("outboxId", ""));
        }
        JSONArray all = read(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < all.length(); i++) if (!id.equals(all.getJSONObject(i).optString("id"))) next.put(all.getJSONObject(i));
        next.put(entry);
        write(context, next);
        arm(context);
        return entry;
    }

    /** Absagen — nur, solange sie noch wartet. */
    static synchronized boolean cancel(Context context, String id) throws JSONException {
        JSONArray all = read(context);
        JSONArray next = new JSONArray();
        boolean removed = false;
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.getJSONObject(i);
            if (id.equals(e.optString("id")) && "scheduled".equals(e.optString("state"))) { removed = true; continue; }
            next.put(e);
        }
        if (removed) {
            write(context, next);
            arm(context);
        }
        return removed;
    }

    /** Vergessen — eine erledigte, deren Ausgang gemeldet ist. */
    static synchronized void forget(Context context, String id) throws JSONException {
        JSONArray all = read(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < all.length(); i++) if (!id.equals(all.getJSONObject(i).optString("id"))) next.put(all.getJSONObject(i));
        write(context, next);
    }

    /** Senden, was fällig ist; dann den nächsten Wecker. Gibt die Gespräche zurück, die sich änderten. */
    static synchronized List<Long> sendDue(Context context) throws JSONException {
        JSONArray all = read(context);
        long now = System.currentTimeMillis();
        List<Long> threads = new ArrayList<>();
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.getJSONObject(i);
            if (!"scheduled".equals(e.optString("state")) || e.optLong("sendAt") > now) continue;
            JSONArray rows = new JSONArray();
            JSONArray to = e.optJSONArray("to");
            try {
                for (int j = 0; to != null && j < to.length(); j++) {
                    Uri row = SmsSender.sendSmsRow(context, to.getString(j), e.optString("body"), e.optInt("subId", -1));
                    rows.put(row.toString());
                }
                e.put("state", "sending").put("rows", rows);
            } catch (RuntimeException failure) {
                Log.w(TAG, "scheduled sms failed", failure);
                e.put("state", "failed").put("rows", rows).put("error", failure.getMessage() == null ? "send" : failure.getMessage()).put("doneAt", now);
            }
            try { threads.add(Long.parseLong(e.optString("threadId", "-1"))); } catch (NumberFormatException ignored) { /* ohne */ }
        }
        write(context, all);
        arm(context);
        return threads;
    }

    /** Hat noch eine aus dem Browser einen Ausgang, den der Dienst nicht kennt? */
    static synchronized boolean reportPending(Context context) throws JSONException {
        JSONArray all = read(context);
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.getJSONObject(i);
            if (e.has("outboxId") && !"scheduled".equals(e.optString("state"))) return true;
        }
        return false;
    }

    /** Der Wecker für die nächste fällige — oder keiner. */
    static synchronized void arm(Context context) {
        long next = Long.MAX_VALUE;
        JSONArray all = read(context);
        for (int i = 0; i < all.length(); i++) {
            JSONObject e = all.optJSONObject(i);
            if (e != null && "scheduled".equals(e.optString("state"))) next = Math.min(next, e.optLong("sendAt", Long.MAX_VALUE));
        }
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        Intent intent = new Intent(ACTION, null, context, ScheduledReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent wake = PendingIntent.getBroadcast(context, 0x5ced, intent, flags);
        if (alarms == null) return;
        if (next == Long.MAX_VALUE) {
            alarms.cancel(wake);
            return;
        }
        long at = Math.max(next, System.currentTimeMillis() + 1000);
        if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake);
        }
    }
}
