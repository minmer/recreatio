package pl.recreatio.app;

import android.content.ContentResolver;
import android.content.Context;
import android.database.ContentObserver;
import android.database.Cursor;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import android.provider.ContactsContract.RawContacts;
import android.telephony.PhoneNumberUtils;
import android.telephony.TelephonyManager;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * NAMEN ZU NUMMERN — das Adressbuch des Telefons einmal gelesen, dann aus dem Speicher.
 *
 * <p>PhoneLookup fragt je Nummer einmal: bei 400 Gesprächen 400 Abfragen, Sekunden — und
 * jeder andere Aufruf der Seite wartete dahinter. Hier sind es zwei Abfragen, danach ein
 * Griff in eine Tabelle; ändert sich das Adressbuch, wird beim nächsten Mal neu gelesen.</p>
 *
 * <p><b>Der Name aus recreatio gewinnt.</b> Legt das Telefon die Abschrift (Konto
 * „REcreatio") mit dem Original zusammen, trägt der Kontakt den Namen, den das Telefon
 * wählt — oft den alten. Hier steht für Nummern aus recreatio dessen Name.</p>
 */
final class ContactIndex {

    private static Map<String, String> byE164 = new HashMap<>();
    private static Map<String, String> byTail = new HashMap<>();
    private static String iso = "PL";
    private static volatile boolean stale = true;
    private static ContentObserver observer;

    private ContactIndex() {
    }

    /** Das Adressbuch hat sich geändert (oder recreatio hat geschrieben): beim nächsten Mal neu lesen. */
    static void invalidate() {
        stale = true;
    }

    /** Die Namen zu {@code numbers}; wen das Adressbuch nicht kennt, der fehlt. */
    static synchronized Map<String, String> names(Context context, Collection<String> numbers) {
        Map<String, String> out = new LinkedHashMap<>();
        if (numbers.isEmpty()) return out;
        try {
            if (stale) build(context.getApplicationContext());
        } catch (RuntimeException e) {
            stale = true;
            return out; // ohne Erlaubnis (Kontakte): keine Namen
        }
        for (String number : numbers) {
            if (number == null || number.isEmpty() || out.containsKey(number)) continue;
            String name = find(number);
            if (name != null) out.put(number, name);
        }
        return out;
    }

    private static String find(String number) {
        String e164 = e164(number);
        if (e164 != null && byE164.containsKey(e164)) return byE164.get(e164);
        String tail = tail(number);
        return tail == null ? null : byTail.get(tail);
    }

    private static String e164(String number) {
        if (number.chars().anyMatch(Character::isLetter)) return null;
        try {
            return PhoneNumberUtils.formatNumberToE164(number, iso);
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Die letzten neun Ziffern — so viele hat eine Nummer hier ohne Vorwahl des Landes. */
    private static String tail(String number) {
        if (number.chars().anyMatch(Character::isLetter)) return null;
        String digits = number.replaceAll("\\D", "");
        if (digits.length() < 7) return null;
        return digits.length() > 9 ? digits.substring(digits.length() - 9) : digits;
    }

    private static void build(Context context) {
        if (observer == null) {
            ContentObserver watch = new ContentObserver(null) {
                @Override
                public void onChange(boolean selfChange) {
                    stale = true;
                }
            };
            context.getContentResolver().registerContentObserver(ContactsContract.AUTHORITY_URI, true, watch);
            observer = watch;
        }
        /* Vor dem Lesen: was sich währenddessen ändert, macht den Stand gleich wieder alt. */
        stale = false;
        TelephonyManager phone = context.getSystemService(TelephonyManager.class);
        String country = phone == null ? null : phone.getSimCountryIso();
        if ((country == null || country.isEmpty()) && phone != null) country = phone.getNetworkCountryIso();
        iso = country == null || country.isEmpty() ? "PL" : country.toUpperCase(Locale.ROOT);

        ContentResolver cr = context.getContentResolver();
        String mine = PhoneContacts.accountType(context);

        /* Die eigenen Namen der Abschriften aus recreatio — nicht der des zusammengelegten Kontakts. */
        Map<Long, String> ours = new HashMap<>();
        try (Cursor c = cr.query(RawContacts.CONTENT_URI, new String[] { RawContacts._ID, RawContacts.DISPLAY_NAME_PRIMARY },
                RawContacts.ACCOUNT_TYPE + " = ? AND " + RawContacts.DELETED + " = 0", new String[] { mine }, null)) {
            while (c != null && c.moveToNext()) if (c.getString(1) != null) ours.put(c.getLong(0), c.getString(1));
        }

        Map<String, String> e164s = new HashMap<>();
        Map<String, String> tails = new HashMap<>();
        Map<String, String> oursE164 = new HashMap<>();
        Map<String, String> oursTail = new HashMap<>();
        try (Cursor c = cr.query(Phone.CONTENT_URI,
                new String[] { Phone.NUMBER, Phone.NORMALIZED_NUMBER, Phone.DISPLAY_NAME, Phone.RAW_CONTACT_ID, RawContacts.ACCOUNT_TYPE },
                null, null, Phone.IS_SUPER_PRIMARY + " DESC")) {
            while (c != null && c.moveToNext()) {
                String number = c.getString(0);
                if (number == null) continue;
                boolean recreatio = mine.equals(c.getString(4));
                String name = recreatio ? ours.get(c.getLong(3)) : null;
                if (name == null) name = c.getString(2);
                if (name == null || name.isEmpty()) continue;
                String normal = c.getString(1);
                if (normal == null || normal.isEmpty()) normal = e164(number);
                String tail = tail(number);
                if (recreatio) {
                    if (normal != null) oursE164.putIfAbsent(normal, name);
                    if (tail != null) oursTail.putIfAbsent(tail, name);
                } else {
                    if (normal != null) e164s.putIfAbsent(normal, name);
                    if (tail != null) tails.putIfAbsent(tail, name);
                }
            }
        }
        e164s.putAll(oursE164);
        tails.putAll(oursTail);
        byE164 = e164s;
        byTail = tails;
    }
}
