package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.JavascriptInterface;

import org.json.JSONObject;

/**
 * WAS DER LÄUFER VOM TELEFON BRAUCHT (2026-10-17) — für das Archiv und das
 * Adressbuch im Hintergrund, wenn die App zu ist ({@link PhoneWork}). Dieselben
 * Namen wie der Baustein der App ({@link PhonePlugin}); Text hinein, Text heraus,
 * ein Fehler als {@code {"error": …}}.
 *
 * <p>Nur die unsichtbare WebView des Läufers bekommt diese Brücke — die lädt
 * ausschliesslich die Dateien der App ({@link RunnerHost}).</p>
 */
final class PhoneBridge {

    static final String PREFS = "recreatio.archive";

    private final Context context;

    PhoneBridge(Context context) {
        this.context = context;
    }

    private static String error(Exception e) {
        try {
            return new JSONObject().put("error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()).toString();
        } catch (Exception ignored) {
            return "{\"error\":\"?\"}";
        }
    }

    @JavascriptInterface
    public String threads(String json) {
        try {
            int limit = Math.max(1, Math.min(5000, new JSONObject(json).optInt("limit", 2000)));
            return new JSONObject().put("threads", SmsStore.threads(context, limit)).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String exportMessages(String json) {
        try {
            JSONObject o = new JSONObject(json);
            return SmsStore.exportPage(context, threadOf(o), o.optLong("afterSms", 0), o.optLong("afterMms", 0),
                    Math.max(1, Math.min(1000, o.optInt("limit", 300)))).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String archiveState() {
        try {
            return new JSONObject().put("state", state(context)).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String setArchiveState(String json) {
        try {
            JSONObject o = new JSONObject(json);
            setState(context, o.optString("state", ""), o.optLong("at", 0));
            return "{}";
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String part(String json) {
        try {
            JSONObject o = new JSONObject(json);
            return SmsStore.part(context, Long.parseLong(o.getString("partId")), Math.max(1, o.optInt("maxBytes", 26 * 1024 * 1024))).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String writeContacts(String json) {
        try {
            return PhoneContacts.write(context, new JSONObject(json).getJSONArray("contacts")).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    /** {@code threadId} eines Auftrags — fehlt er, gilt das ganze Telefon (-1). */
    static long threadOf(JSONObject o) {
        String text = o.isNull("threadId") ? "" : o.optString("threadId", "");
        try {
            return text.isEmpty() ? -1 : Long.parseLong(text);
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /* -- Der Stand des Archivs auf diesem Telefon ---------------------------------------------- */

    /**
     * Bis wohin jedes Gespräch dieses Telefons archiviert ist — als Text, den die Seite
     * selbst deutet (`smsArchive.ts`). Er gehört zu DIESEM Telefon: ein zweites (das alte)
     * hat seinen eigenen, das Archiv ist dasselbe.
     */
    static String state(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("state", "");
    }

    /** {@code at}: wann zuletzt archiviert wurde (0: unverändert). */
    static void setState(Context context, String state, long at) {
        SharedPreferences.Editor edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("state", state);
        if (at > 0) edit.putLong("at", at);
        edit.apply();
    }

    static long archivedAt(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("at", 0);
    }
}
