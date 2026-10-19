package pl.recreatio.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TimeZone;

/**
 * DIE TIMER DER LAMPEN (2026-10-18) — zu Uhrzeiten, an gewählten Wochentagen,
 * einer oder mehrere Sygnały nacheinander, auch wenn die App zu ist.
 *
 * <p><b>Der Plan liegt im Telefon.</b> Die Timer selbst stehen versiegelt im Dienst
 * (`lampStore.ts`); die Seite rechnet daraus den Plan — je Timer Uhrzeit, Tage und die
 * Ramki seiner Sygnały — und legt ihn hier ab ({@code setTimers}). Zur Zeit liest ihn
 * der Wecker, ohne Netz und ohne Schlüssel. Die Bytes der Sygnały stehen dafür offen in
 * den Einstellungen der App (keine Sicherung, {@code allowBackup=false}).</p>
 *
 * <p><b>Ein Telefon führt sie aus</b> — das, auf dem es eingeschaltet ist ({@code on}).
 * Sonst schalteten zwei Telefone dieselbe Lampe zweimal. Wer auf einem Telefon den
 * ersten Timer anlegt, schaltet es dort ein ({@code decided}).</p>
 *
 * <p><b>Das Tempo</b> jedes Timers (seine eigenen zwei Regler) steckt schon im Plan: die
 * Ramki sind gekürzt und haben mehr Pause dazwischen, und zwischen den Aktionen steht
 * {@code pauseMs}.</p>
 *
 * <p><b>Ein Wecker</b> für die nächste fällige Minute (genau, wo Android es erlaubt —
 * {@code USE_EXACT_ALARM} ab Android 13; davor ungenau). Klingelt er, laufen alle Timer
 * dieser Minute nacheinander ({@link LampTimerReceiver}), dann wird der nächste gestellt.
 * Nach einem Neustart, einer neuen Fassung oder einer anderen Zeitzone wird neu gestellt.</p>
 */
final class LampTimers {

    static final String ACTION = "pl.recreatio.app.LAMP_TIMER";
    private static final String PREFS = "recreatio.lamps";
    private static final String CHANNEL = "lamp_timers";
    private static final int REQUEST = 0x1a4b;
    private static final int NOTICE = 0x1a4c;
    private static final int LOG_MAX = 20;
    private static final String TAG = "recreatio";

    private LampTimers() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* -- Die Zeit ------------------------------------------------------------------------------- */

    /** Montag = 1 … Sonntag = 7 (wie auf der Seite). */
    static int isoDay(Calendar cal) {
        return ((cal.get(Calendar.DAY_OF_WEEK) + 5) % 7) + 1;
    }

    /** {@code days}: Bit 0 = Montag … Bit 6 = Sonntag; 0 = jeden Tag. */
    static boolean dayFits(int days, int isoDay) {
        return days == 0 || (days & (1 << (isoDay - 1))) != 0;
    }

    /**
     * Wann ein Timer das nächste Mal dran ist — nach {@code now}, in der Zeitzone
     * {@code zone}; {@code -1}, wenn nie. Eine Uhrzeit, die es wegen der Zeitumstellung an
     * einem Tag nicht gibt, schiebt Android eine Stunde weiter.
     */
    static long next(long now, TimeZone zone, int minuteOfDay, int days) {
        if (minuteOfDay < 0 || minuteOfDay >= 24 * 60) return -1;
        Calendar cal = Calendar.getInstance(zone);
        cal.setTimeInMillis(now);
        for (int i = 0; i <= 7; i++) {
            cal.set(Calendar.HOUR_OF_DAY, minuteOfDay / 60);
            cal.set(Calendar.MINUTE, minuteOfDay % 60);
            cal.set(Calendar.SECOND, 0);
            cal.set(Calendar.MILLISECOND, 0);
            if (cal.getTimeInMillis() > now && dayFits(days, isoDay(cal))) return cal.getTimeInMillis();
            cal.add(Calendar.DAY_OF_MONTH, 1);
        }
        return -1;
    }

    /* -- Der Plan ------------------------------------------------------------------------------- */

    static synchronized JSONArray plan(Context context) {
        try {
            return new JSONArray(prefs(context).getString("plan", "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    static synchronized void store(Context context, JSONArray timers) {
        prefs(context).edit().putString("plan", timers.toString()).remove("pace").apply();
        arm(context);
    }

    static synchronized void setOn(Context context, boolean on) {
        prefs(context).edit().putBoolean("on", on).putBoolean("decided", true).apply();
        arm(context);
    }

    static boolean on(Context context) {
        return prefs(context).getBoolean("on", false);
    }

    static boolean decided(Context context) {
        return prefs(context).getBoolean("decided", false);
    }

    private static boolean exact(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        return Build.VERSION.SDK_INT < 31 || (alarms != null && alarms.canScheduleExactAlarms());
    }

    /** Der früheste nächste Zeitpunkt aller Timer — und welche dann dran sind. */
    private static long earliest(JSONArray plan, long now, List<String> names) {
        long best = Long.MAX_VALUE;
        TimeZone zone = TimeZone.getDefault();
        for (int i = 0; i < plan.length(); i++) {
            JSONObject t = plan.optJSONObject(i);
            if (t == null) continue;
            long at = next(now, zone, t.optInt("minute", -1), t.optInt("days", 0));
            if (at < 0) continue;
            if (at < best) {
                best = at;
                names.clear();
            }
            if (at == best) names.add(t.optString("name", "Timer"));
        }
        return best;
    }

    /** Den Wecker für die nächste fällige Minute stellen — oder abstellen. */
    static synchronized void arm(Context context) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        if (alarms == null) return;
        long at = on(context) ? earliest(plan(context), System.currentTimeMillis(), new ArrayList<>()) : Long.MAX_VALUE;
        Intent intent = new Intent(ACTION, null, context, LampTimerReceiver.class);
        intent.putExtra("at", at == Long.MAX_VALUE ? 0 : at);
        PendingIntent wake = PendingIntent.getBroadcast(context, REQUEST, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (at == Long.MAX_VALUE) {
            alarms.cancel(wake);
            return;
        }
        if (exact(context)) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake);
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake);
        }
    }

    /* -- Zur Zeit ------------------------------------------------------------------------------ */

    /**
     * Der Wecker klingelt (auf {@link LampRadio#RADIO}): alle Timer, deren Minute und Tag
     * {@code at} treffen, nacheinander — jede Aktion für sich, ein Fehler hält die nächste
     * nicht auf. Dann ins Protokoll und der nächste Wecker.
     */
    static void fire(Context context, long at) {
        long planned = at > 0 ? at : (System.currentTimeMillis() / 60_000L) * 60_000L;
        SharedPreferences prefs = prefs(context);
        if (prefs.getLong("firedAt", 0) == planned) {
            arm(context);
            return;
        }
        prefs.edit().putLong("firedAt", planned).apply();

        Calendar cal = Calendar.getInstance();
        cal.setTimeInMillis(planned);
        int minute = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE);
        int day = isoDay(cal);

        JSONArray plan = plan(context);
        for (int i = 0; i < plan.length() && on(context); i++) {
            JSONObject t = plan.optJSONObject(i);
            if (t == null || t.optInt("minute", -1) != minute || !dayFits(t.optInt("days", 0), day)) continue;
            run(context, t, planned);
        }
        arm(context);
    }

    private static void run(Context context, JSONObject timer, long planned) {
        JSONArray actions = timer.optJSONArray("actions");
        int total = actions == null ? 0 : actions.length();
        long pause = Math.max(0, Math.min(LampFrame.MAX_GAP_MS, timer.optLong("pauseMs", 0)));
        int ok = 0;
        JSArray failed = new JSArray();
        for (int i = 0; i < total; i++) {
            JSONObject action = actions.optJSONObject(i);
            if (action == null) continue;
            /* Das Tempo des Timers: eine Pause vor jeder weiteren Aktion — die Lampe zählt sie einzeln. */
            if (i > 0 && pause > 0) LampRadio.NEVER.hold(pause);
            String code;
            String detail = null;
            try {
                JSObject result = LampRadio.transmit(context, LampRadio.framesOf(action.optJSONArray("frames")), LampRadio.NEVER);
                code = result.getString("code");
                detail = result.isNull("detail") ? null : result.optString("detail");
            } catch (Exception e) {
                code = "bad-frame";
                detail = e.getMessage();
            }
            if ("ok".equals(code)) {
                ok++;
            } else {
                JSObject one = new JSObject();
                one.put("label", action.optString("label", "Sygnał"));
                one.put("code", code);
                one.put("detail", LampRadio.orNull(detail));
                failed.put(one);
            }
        }

        JSObject entry = new JSObject();
        entry.put("at", planned);
        entry.put("ranAt", System.currentTimeMillis());
        entry.put("timerId", timer.optString("id"));
        entry.put("name", timer.optString("name", "Timer"));
        entry.put("ok", ok);
        entry.put("total", total);
        entry.put("failed", failed);
        remember(context, entry);
        if (failed.length() > 0) tell(context, timer.optString("name", "Timer"), failed);
    }

    private static synchronized void remember(Context context, JSONObject entry) {
        JSONArray log;
        try {
            log = new JSONArray(prefs(context).getString("log", "[]"));
        } catch (Exception e) {
            log = new JSONArray();
        }
        JSONArray next = new JSONArray();
        next.put(entry);
        for (int i = 0; i < log.length() && next.length() < LOG_MAX; i++) next.put(log.opt(i));
        prefs(context).edit().putString("log", next.toString()).apply();
    }

    /** Ging etwas nicht hinaus, soll man es wissen — die App ist dabei meist zu. */
    @SuppressLint("MissingPermission")
    private static void tell(Context context, String name, JSONArray failed) {
        if (Build.VERSION.SDK_INT >= 33
            && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                if (manager != null && manager.getNotificationChannel(CHANNEL) == null) {
                    NotificationChannel channel = new NotificationChannel(CHANNEL, "Timery lamp", NotificationManager.IMPORTANCE_DEFAULT);
                    channel.setDescription("Gdy timer nie mógł nadać sygnału");
                    manager.createNotificationChannel(channel);
                }
            }
            JSONObject first = failed.getJSONObject(0);
            String why = "bluetooth-off".equals(first.optString("code")) ? "Bluetooth jest wyłączony"
                : "no-permission".equals(first.optString("code")) ? "brak zgody „Urządzenia w pobliżu\""
                : first.optString("code");
            Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            PendingIntent tap = open == null ? null : PendingIntent.getActivity(context, NOTICE, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            NotificationCompat.Builder notice = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle("Timer „" + name + "\" nie nadał " + failed.length() + (failed.length() == 1 ? " sygnału" : " sygnałów"))
                .setContentText(first.optString("label") + ": " + why)
                .setAutoCancel(true)
                .setContentIntent(tap);
            NotificationManagerCompat.from(context).notify(NOTICE, notice.build());
        } catch (Exception e) {
            Log.w(TAG, "lamp timer notice", e);
        }
    }

    /* -- Für die Seite ------------------------------------------------------------------------- */

    static JSObject status(Context context) {
        JSObject out = new JSObject();
        out.put("on", on(context));
        out.put("decided", decided(context));
        out.put("exact", exact(context));
        JSONArray plan = plan(context);
        out.put("count", plan.length());
        List<String> names = new ArrayList<>();
        long at = on(context) ? earliest(plan, System.currentTimeMillis(), names) : Long.MAX_VALUE;
        if (at == Long.MAX_VALUE) {
            out.put("next", JSONObject.NULL);
        } else {
            JSObject next = new JSObject();
            next.put("at", at);
            next.put("names", new JSONArray(names));
            out.put("next", next);
        }
        try {
            out.put("log", new JSONArray(prefs(context).getString("log", "[]")));
        } catch (Exception e) {
            out.put("log", new JSONArray());
        }
        return out;
    }
}
