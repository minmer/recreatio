package pl.recreatio.app;

import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.provider.BlockedNumberContract;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * STILL UND GESPERRT (2026-10-19) — was ein Gespräch darf, ohne dass es die Seite fragt.
 *
 * <code>
 *   wyciszone    je Gespräch ein Ende (ms; 0 = für immer): {@link SmsNotices} meldet sich nicht
 *   zablokowane  im Telefon (BlockedNumberContract — das Telefon nimmt dann auch keine Anrufe an)
 *                und hier (auch Absender ohne Rufnummer, „INFO"): was von einem gesperrten kommt,
 *                schreibt {@link SmsReceiver} nicht auf und {@link MmsReceiver} lädt es nicht
 *   karta        je Gespräch die Karte (subId) für Antworten aus der Meldung — die Seite legt sie
 *                fest (eine Gruppe mit eigener Nummer, die Wahl im Kopf des Gesprächs)
 * </code>
 */
final class Spam {

    private static final String PREFS = "recreatio.quiet";
    private static final String TAG = "recreatio";

    private Spam() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject object(Context context, String name) {
        try {
            return new JSONObject(prefs(context).getString(name, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void write(Context context, String name, JSONObject value) {
        prefs(context).edit().putString(name, value.toString()).apply();
    }

    /**
     * Wie eine Nummer verglichen wird: ein Absender mit Buchstaben klein, eine Rufnummer
     * mit ihren letzten neun Ziffern — „+48 600 100 200", „0048600100200" und „600100200"
     * sind dieselbe.
     */
    static String key(String address) {
        if (address == null) return "";
        String text = address.trim();
        if (text.isEmpty()) return "";
        for (int i = 0; i < text.length(); i++) {
            if (Character.isLetter(text.charAt(i))) return text.toLowerCase(Locale.ROOT);
        }
        String digits = text.replaceAll("[^0-9]", "");
        return digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
    }

    /* -- Wyciszone ------------------------------------------------------------------------------ */

    /** Still bis {@code until} (ms; 0 = für immer); {@code until} &lt; 0: wieder laut. */
    static synchronized void mute(Context context, long thread, long until) {
        JSONObject all = object(context, "muted");
        try {
            if (until < 0) all.remove(String.valueOf(thread));
            else all.put(String.valueOf(thread), until);
        } catch (JSONException ignored) {
            return;
        }
        write(context, "muted", all);
    }

    static synchronized boolean muted(Context context, long thread) {
        JSONObject all = object(context, "muted");
        String id = String.valueOf(thread);
        if (!all.has(id)) return false;
        long until = all.optLong(id, 0);
        if (until == 0 || until > System.currentTimeMillis()) return true;
        all.remove(id);
        write(context, "muted", all);
        return false;
    }

    /** {Gespräch: Ende} — Abgelaufenes fällt dabei weg. */
    static synchronized JSONObject mutes(Context context) {
        JSONObject all = object(context, "muted");
        JSONObject out = new JSONObject();
        long now = System.currentTimeMillis();
        boolean changed = false;
        for (Iterator<String> it = all.keys(); it.hasNext(); ) {
            String id = it.next();
            long until = all.optLong(id, 0);
            if (until != 0 && until <= now) { changed = true; continue; }
            try { out.put(id, until); } catch (JSONException ignored) { /* nicht */ }
        }
        if (changed) write(context, "muted", out);
        return out;
    }

    /* -- Zablokowane ------------------------------------------------------------------------- */

    /** Darf diese App im Telefon sperren? Nur als SMS-App (oder Telefon-App) des Telefons. */
    static boolean canBlock(Context context) {
        try {
            return BlockedNumberContract.canCurrentUserBlockNumbers(context);
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Sperren — im Telefon (wenn es geht) und hier. */
    static synchronized boolean block(Context context, String address) {
        String k = key(address);
        if (k.isEmpty()) return false;
        boolean system = false;
        if (canBlock(context)) {
            try {
                ContentValues v = new ContentValues();
                v.put(BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER, address.trim());
                context.getContentResolver().insert(BlockedNumberContract.BlockedNumbers.CONTENT_URI, v);
                system = true;
            } catch (RuntimeException e) {
                Log.w(TAG, "system block failed", e);
            }
        }
        JSONObject own = object(context, "blocked");
        try {
            own.put(k, address.trim());
        } catch (JSONException ignored) {
            return system;
        }
        write(context, "blocked", own);
        return true;
    }

    static synchronized void unblock(Context context, String address) {
        if (canBlock(context)) {
            try {
                BlockedNumberContract.unblock(context, address);
            } catch (RuntimeException e) {
                Log.w(TAG, "system unblock failed", e);
            }
        }
        JSONObject own = object(context, "blocked");
        own.remove(key(address));
        write(context, "blocked", own);
    }

    /** Ist der Absender gesperrt — hier oder im Telefon? */
    static boolean blocked(Context context, String address) {
        String k = key(address);
        if (k.isEmpty()) return false;
        if (object(context, "blocked").has(k)) return true;
        if (!canBlock(context)) return false;
        try {
            return BlockedNumberContract.isBlocked(context, address);
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Alle gesperrten — die im Telefon (auch aus der Telefon-App) und die von hier. */
    static synchronized JSONArray blockedList(Context context) {
        Map<String, String> all = new LinkedHashMap<>();
        if (canBlock(context)) {
            try (Cursor c = context.getContentResolver().query(BlockedNumberContract.BlockedNumbers.CONTENT_URI,
                    new String[] { BlockedNumberContract.BlockedNumbers.COLUMN_ORIGINAL_NUMBER }, null, null, null)) {
                while (c != null && c.moveToNext()) {
                    String number = c.getString(0);
                    if (number != null && !number.trim().isEmpty()) all.put(key(number), number.trim());
                }
            } catch (RuntimeException e) {
                Log.w(TAG, "blocked list", e);
            }
        }
        JSONObject own = object(context, "blocked");
        for (Iterator<String> it = own.keys(); it.hasNext(); ) {
            String k = it.next();
            if (!all.containsKey(k)) all.put(k, own.optString(k, k));
        }
        JSONArray out = new JSONArray();
        for (String number : all.values()) out.put(number);
        return out;
    }

    /* -- Karta je Gespräch ------------------------------------------------------------------- */

    /** Die Karte für Antworten aus der Meldung — {@code sub} &lt; 0: keine eigene Wahl. */
    static synchronized void threadSubs(Context context, JSONObject subs) {
        JSONObject all = object(context, "subs");
        for (Iterator<String> it = subs.keys(); it.hasNext(); ) {
            String id = it.next();
            int sub = subs.optInt(id, -1);
            try {
                if (sub < 0) all.remove(id); else all.put(id, sub);
            } catch (JSONException ignored) {
                // nicht
            }
        }
        write(context, "subs", all);
    }

    static int threadSub(Context context, long thread) {
        return object(context, "subs").optInt(String.valueOf(thread), -1);
    }
}
