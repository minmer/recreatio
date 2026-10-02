package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * NACHSEHEN, MIT INHALT (0076) — für den Wecker von Firebase und den Takt.
 *
 * <code>
 *   1  die Zahlen vom Dienst, mit dem Gerätekennzeichen (/notify/digest)
 *   2  hat sich etwas geändert (Zahlen, jüngste Nachricht) — oder sind die
 *      Erinnerungen fällig? Sonst: nichts tun, keine WebView
 *   3  der Läufer öffnet den Inhalt (RunnerHost, notifyRich.gatherNews)
 *   4  das Telefon zeigt ihn (Notices) und stellt den Wecker (Reminders)
 *   5  geht der Inhalt nicht auf (strenge Betriebsart, keine Sitzung): die
 *      Zahlen wie bisher (NotifyWorker.counts)
 * </code>
 *
 * <p>Firebase trägt dabei nur „sieh nach"; die Inhalte kommen versiegelt über
 * die eigene Verbindung und werden auf diesem Telefon geöffnet.</p>
 */
final class Inbox {

    private static final String TAG = "recreatio";
    private static final long RUN_MS = 45_000;
    /** Erinnerungen neu planen (mit Titeln, auch für Aufgaben anderer im Bereich) — höchstens stündlich: jede Planung startet die WebView. */
    private static final long PLAN_EVERY_MS = 60 * 60_000;

    private Inbox() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NotifyWorker.PREFS, Context.MODE_PRIVATE);
    }

    /** Ein Wecksignal kam (vielleicht während schon nachgesehen wird): danach noch einmal. */
    static void again(Context context) {
        prefs(context).edit().putBoolean("again", true).apply();
    }

    /** Nachsehen, bis kein Wecksignal mehr dazwischenkam (höchstens dreimal). */
    static NotifyWorker.Outcome checkUntilQuiet(Context context) {
        NotifyWorker.Outcome outcome = NotifyWorker.Outcome.DONE;
        for (int round = 0; round < 3; round++) {
            boolean forced = prefs(context).getBoolean("again", false);
            prefs(context).edit().putBoolean("again", false).apply();
            outcome = check(context, forced);
            if (!prefs(context).getBoolean("again", false)) break;
        }
        return outcome;
    }

    /**
     * EINMAL NACHSEHEN. {@code forced}: ein Wecksignal kam — dann auch dann
     * öffnen, wenn der Dienst die jüngste Nachricht (noch) nicht als Zeit mitgibt.
     */
    static synchronized NotifyWorker.Outcome check(Context context, boolean forced) {
        SharedPreferences prefs = prefs(context);
        String api = prefs.getString("api", null);
        String token = prefs.getString("token", null);
        if (api == null || token == null) return NotifyWorker.Outcome.DONE;

        String since = prefs.getString("since", "");
        JSONObject digest;
        HttpURLConnection connection = null;
        try {
            String address = api + "/notify/digest" + (since.isEmpty() ? "" : "?since=" + URLEncoder.encode(since, "UTF-8"));
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("X-Notify-Token", token);
            connection.setRequestProperty("Accept", "application/json");
            int status = connection.getResponseCode();
            if (status == 401) {
                /* Abgemeldet oder zurückgezogen — nicht weiter fragen. */
                prefs.edit().remove("token").apply();
                return NotifyWorker.Outcome.DONE;
            }
            if (status != 200) return NotifyWorker.Outcome.RETRY;
            digest = new JSONObject(read(connection.getInputStream()));
        } catch (Exception e) {
            return NotifyWorker.Outcome.RETRY;
        } finally {
            if (connection != null) connection.disconnect();
        }

        JSONObject chats = digest.optJSONObject("chats");
        int loud = chats == null ? 0 : chats.optInt("loud", 0);
        String newest = chats == null || chats.isNull("newestAt") ? "" : chats.optString("newestAt", "");
        int forms = digest.optJSONObject("registrations") == null ? 0 : digest.optJSONObject("registrations").optInt("count", 0);
        int links = digest.optInt("links", 0);

        String stamp = loud + "|" + newest + "|" + forms + "|" + links;
        boolean changed = !stamp.equals(prefs.getString("richStamp", "")) || (forced && newest.isEmpty());
        boolean plan = prefs.getBoolean("reminders", true) && System.currentTimeMillis() - prefs.getLong("planAt", 0) > PLAN_EVERY_MS;
        if (!changed && !plan) return NotifyWorker.Outcome.DONE;

        /* Ging der Schlüssel zuletzt nicht auf, lohnt eine WebView nur für etwas Neues — nicht bloss für den Wecker. */
        boolean lockedLately = prefs.getString("richResult", "").startsWith("locked")
                && System.currentTimeMillis() - prefs.getLong("richAt", 0) < 6 * 3600_000L;
        if (!changed && lockedLately) return NotifyWorker.Outcome.DONE;

        if (prefs.getBoolean("contents", true)) {
            try {
                JSONObject check = new JSONObject()
                        .put("since", since.isEmpty() ? iso(System.currentTimeMillis() - 3L * 86400_000L) : since)
                        .put("shown", Notices.shownChats(context))
                        .put("formsShown", Notices.shownForms(context))
                        .put("reminders", plan)
                        .put("replyable", true)
                        .put("settings", new JSONObject()
                                .put("chats", prefs.getBoolean("chats", true))
                                .put("forms", prefs.getBoolean("forms", true))
                                .put("links", prefs.getBoolean("links", true))
                                .put("reminders", prefs.getBoolean("reminders", true)));
                int linksShown = Notices.shownLinks(context);
                if (linksShown >= 0) check.put("linksShown", linksShown);

                JSONObject news = RunnerHost.run(context, new JSONObject().put("kind", "check").put("check", check), RUN_MS);
                if ("open".equals(news.optString("state"))) {
                    Notices.present(context, news);
                    SharedPreferences.Editor edit = prefs.edit()
                            .putString("richStamp", stamp)
                            .putInt("seenLoud", loud).putInt("seenForms", forms).putInt("seenLinks", links)
                            .putString("richResult", "open")
                            .putLong("richAt", System.currentTimeMillis());
                    JSONArray reminders = news.isNull("reminders") ? null : news.optJSONArray("reminders");
                    if (reminders != null) {
                        Reminders.plan(context, reminders);
                        edit.putLong("planAt", System.currentTimeMillis());
                    }
                    edit.apply();
                    return NotifyWorker.Outcome.DONE;
                }
                record(prefs, "locked:" + news.optString("reason", "key"));
            } catch (Exception e) {
                Log.w(TAG, "rich check failed", e);
                record(prefs, "failed:" + e.getClass().getSimpleName());
            }
        }

        /* Ohne Inhalt: die Zahlen, wie bisher. */
        if (!changed) return NotifyWorker.Outcome.DONE;
        NotifyWorker.counts(context, loud, forms, links);
        prefs.edit().putString("richStamp", stamp).apply();
        return NotifyWorker.Outcome.DONE;
    }

    private static void record(SharedPreferences prefs, String result) {
        prefs.edit().putString("richResult", result).putLong("richAt", System.currentTimeMillis()).apply();
    }

    static String iso(long ms) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(ms));
    }

    static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int n;
        while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        in.close();
        return out.toString(StandardCharsets.UTF_8.name());
    }
}
