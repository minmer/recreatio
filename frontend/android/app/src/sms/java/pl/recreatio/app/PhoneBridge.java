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
    public String exportMessages(String json) {
        try {
            JSONObject o = new JSONObject(json);
            return SmsStore.exportPage(context, o.optLong("afterSms", 0), o.optLong("afterMms", 0), Math.max(1, Math.min(1000, o.optInt("limit", 300)))).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String archiveMarkers() {
        try {
            return markers(context).toString();
        } catch (Exception e) {
            return error(e);
        }
    }

    @JavascriptInterface
    public String setArchiveMarkers(String json) {
        try {
            JSONObject o = new JSONObject(json);
            setMarkers(context, o.optLong("sms", 0), o.optLong("mms", 0), o.optLong("at", System.currentTimeMillis()));
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

    /* -- Die Marken des Archivs: bis wohin es reicht ------------------------------------------- */

    static JSONObject markers(Context context) throws org.json.JSONException {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        return new JSONObject().put("sms", prefs.getLong("sms", 0)).put("mms", prefs.getLong("mms", 0));
    }

    static void setMarkers(Context context, long sms, long mms, long at) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong("sms", Math.max(0, sms)).putLong("mms", Math.max(0, mms)).putLong("at", at).apply();
    }

    static long archivedAt(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("at", 0);
    }
}
