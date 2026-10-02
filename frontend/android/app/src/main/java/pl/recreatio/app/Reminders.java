package pl.recreatio.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashSet;
import java.util.Set;

/**
 * DER WECKER FÜR AUFGABEN (0076) — Erinnerungen mit Titel und „Zrobione".
 *
 * <p>Geplant wird von zwei Seiten mit derselben Liste
 * ({@code notifyRich.remindersFor}): von der Seite, wenn die App offen ist,
 * und vom Läufer im Hintergrund (höchstens jede halbe Stunde) — so kommen auch
 * Aufgaben, die andere im Bereich anlegen, ohne dass jemand die App öffnet.</p>
 *
 * <p><b>Ungenau, wie zuvor</b> ({@code setAndAllowWhileIdle}): Google Play
 * erlaubt genaue Wecker nur Wecker- und Kalender-Apps. Eine Erinnerung darf
 * ein paar Minuten später kommen. Nach einem Neustart stellt
 * {@link ReminderReceiver} sie wieder hin.</p>
 */
final class Reminders {

    private static final String PREFS = "recreatio.reminders";
    private static final String ACTION_FIRE = "pl.recreatio.app.REMINDER";

    private Reminders() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONArray stored(Context context) {
        try {
            return new JSONArray(prefs(context).getString("list", "[]"));
        } catch (JSONException e) {
            return new JSONArray();
        }
    }

    private static PendingIntent alarm(Context context, String tag, int flags) {
        Intent intent = new Intent(context, ReminderReceiver.class)
                .setAction(ACTION_FIRE)
                .setData(Uri.parse("recreatio-reminder:" + Uri.encode(tag)))
                .putExtra("tag", tag);
        return PendingIntent.getBroadcast(context, Notices.numberOf(tag), intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Die Liste ersetzt, was vorher geplant war. */
    static synchronized void plan(Context context, JSONArray list) throws JSONException {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;

        Set<String> wanted = new HashSet<>();
        JSONArray kept = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < list.length() && kept.length() < 60; i++) {
            JSONObject one = list.getJSONObject(i);
            long at = one.optLong("ms", 0);
            if (at <= now + 30_000) continue;
            wanted.add(one.getString("tag"));
            kept.put(one);
        }

        JSONArray before = stored(context);
        for (int i = 0; i < before.length(); i++) {
            String tag = before.getJSONObject(i).optString("tag");
            if (wanted.contains(tag)) continue;
            PendingIntent old = alarm(context, tag, PendingIntent.FLAG_NO_CREATE);
            if (old != null) {
                alarms.cancel(old);
                old.cancel();
            }
        }

        for (int i = 0; i < kept.length(); i++) {
            JSONObject one = kept.getJSONObject(i);
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, one.getLong("ms"),
                    alarm(context, one.getString("tag"), PendingIntent.FLAG_UPDATE_CURRENT));
        }
        prefs(context).edit().putString("list", kept.toString()).apply();
    }

    /** Nach einem Neustart (oder einer neuen Fassung der App): alles wieder hinstellen. */
    static void restore(Context context) {
        try {
            plan(context, stored(context));
        } catch (JSONException ignored) {
            // Eine unlesbare Liste plant der nächste Lauf neu.
        }
    }

    private static JSONObject find(Context context, String tag) throws JSONException {
        JSONArray list = stored(context);
        for (int i = 0; i < list.length(); i++) {
            JSONObject one = list.getJSONObject(i);
            if (tag.equals(one.optString("tag"))) return one;
        }
        return null;
    }

    /** Der Wecker klingelt: die Erinnerung zeigen — mit „Zrobione", wenn es eine Aufgabe ist. */
    static synchronized void fire(Context context, String tag) throws JSONException {
        JSONObject one = find(context, tag);
        if (one == null) return;
        Notices.ensureChannels(context);
        Notices.post(context, Notices.numberOf(tag), builder(context, one, one.optString("body"), true));
    }

    private static NotificationCompat.Builder builder(Context context, JSONObject one, String text, boolean withDone) {
        String tag = one.optString("tag");
        String title = one.optString("title", "Zadanie");
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, Notices.CHANNEL_TASKS)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(Notices.openIntent(context, one.optString("open"), Notices.numberOf("open:" + tag)))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(new NotificationCompat.Builder(context, Notices.CHANNEL_TASKS)
                        .setSmallIcon(R.drawable.ic_stat_recreatio)
                        .setContentTitle("REcreatio")
                        .setContentText("Przypomnienie o zadaniu")
                        .build());
        String taskId = one.optString("taskId", "");
        if (withDone && !taskId.isEmpty()) {
            Intent extras = new Intent()
                    .putExtra("tag", tag)
                    .putExtra("taskId", taskId)
                    .putExtra("occurrenceAt", one.isNull("occurrenceAt") ? null : one.optString("occurrenceAt", null));
            builder.addAction(new NotificationCompat.Action.Builder(R.drawable.ic_stat_recreatio, "Zrobione",
                    Notices.action(context, ActionReceiver.ACTION_DONE, tag, extras, false))
                    .setShowsUserInterface(false)
                    .build());
        }
        return builder;
    }

    /** „Zrobione" getippt: sofort sichtbar, ohne Knopf — der Läufer trägt es ein. */
    static synchronized void doing(Context context, String tag) throws JSONException {
        JSONObject one = find(context, tag);
        if (one == null) one = new JSONObject().put("tag", tag).put("title", "Zadanie").put("open", "#/workspace/tasks");
        Notices.post(context, Notices.numberOf(tag), builder(context, one, "Oznaczanie jako zrobione…", false).setSilent(true));
    }

    /** Eingetragen — Meldung weg; sonst sagen, warum, und den Knopf zurückgeben. */
    static synchronized void done(Context context, String tag, boolean ok, String error) throws JSONException {
        if (ok) {
            Notices.cancel(context, Notices.numberOf(tag));
            return;
        }
        JSONObject one = find(context, tag);
        if (one == null) one = new JSONObject().put("tag", tag).put("title", "Zadanie").put("open", "#/workspace/tasks");
        String why = error == null || error.isEmpty() ? "" : " — " + error;
        Notices.post(context, Notices.numberOf(tag), builder(context, one, "Nie udało się oznaczyć" + why, true).setSilent(true));
    }

    /** Beim Abmelden: kein Wecker mehr. */
    static void clear(Context context) {
        try {
            plan(context, new JSONArray());
        } catch (JSONException ignored) {
            // Nichts geplant.
        }
        prefs(context).edit().clear().apply();
    }
}
