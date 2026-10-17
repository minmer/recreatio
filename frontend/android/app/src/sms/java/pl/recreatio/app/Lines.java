package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.telephony.TelephonyManager;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.List;

/**
 * DIE EIGENEN NUMMERN (2026-10-18) — von welcher Nummer dieses Telefon sendet.
 *
 * <p>Das Archiv merkt sich bei jeder Nachricht die eigene Nummer, und eine Antwort
 * aus dem Browser nimmt nur ein Telefon, das diese Nummer hat (0116). Viele Karten
 * nennen ihre Nummer nicht; dann trägt man sie in der App ein ({@link #set}),
 * je Karte, nur auf diesem Telefon.</p>
 */
final class Lines {

    private static final String PREFS = "recreatio.lines";

    private Lines() {
    }

    /** {@code [{subId, slot, name, number, known}]} — {@code known}: die Karte nennt die Nummer selbst. */
    static JSONArray all(Context context) throws JSONException {
        SharedPreferences own = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray out = new JSONArray();
        List<SubscriptionInfo> list = null;
        SubscriptionManager subs = context.getSystemService(SubscriptionManager.class);
        boolean mayRead = context.checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        try {
            if (mayRead && subs != null) list = subs.getActiveSubscriptionInfoList();
        } catch (RuntimeException ignored) {
            list = null;
        }
        if (list == null || list.isEmpty()) {
            /* Ohne Zugang zu den Karten: eine Zeile für „diese Telefon", die Nummer eingetragen. */
            String number = own.getString("sub:-1", null);
            out.put(new JSONObject().put("subId", -1).put("slot", 0).put("name", "SIM")
                    .put("number", number == null ? JSONObject.NULL : number).put("known", false));
            return out;
        }
        for (SubscriptionInfo info : list) {
            int subId = info.getSubscriptionId();
            String known = numberOf(context, subs, info);
            String typed = own.getString("sub:" + subId, null);
            String number = known != null ? known : typed;
            out.put(new JSONObject()
                    .put("subId", subId)
                    .put("slot", info.getSimSlotIndex())
                    .put("name", info.getDisplayName() == null ? "SIM " + (info.getSimSlotIndex() + 1) : info.getDisplayName().toString())
                    .put("number", number == null ? JSONObject.NULL : number)
                    .put("known", known != null));
        }
        return out;
    }

    /** Die Nummer, wie die Karte sie nennt — oder {@code null}. */
    private static String numberOf(Context context, SubscriptionManager subs, SubscriptionInfo info) {
        String number = null;
        try {
            number = Build.VERSION.SDK_INT >= 33 ? subs.getPhoneNumber(info.getSubscriptionId()) : info.getNumber();
        } catch (RuntimeException ignored) {
            // ohne Erlaubnis
        }
        if (number == null || number.trim().isEmpty()) {
            /* Die SMS-App darf die Nummer der Leitung lesen, auch ohne READ_PHONE_NUMBERS. */
            try {
                TelephonyManager phone = context.getSystemService(TelephonyManager.class);
                if (phone != null) number = phone.createForSubscriptionId(info.getSubscriptionId()).getLine1Number();
            } catch (RuntimeException ignored) {
                number = null;
            }
        }
        return number == null || number.trim().isEmpty() ? null : number.trim();
    }

    /** Die Nummer einer Karte eintragen ({@code null}: wieder vergessen). */
    static void set(Context context, int subId, String number) {
        SharedPreferences.Editor edit = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        if (number == null || number.trim().isEmpty()) edit.remove("sub:" + subId); else edit.putString("sub:" + subId, number.trim());
        edit.apply();
    }
}
