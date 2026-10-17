package pl.recreatio.app;

import android.accounts.Account;
import android.accounts.AccountManager;
import android.content.ContentProviderOperation;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;
import android.provider.ContactsContract.CommonDataKinds.Email;
import android.provider.ContactsContract.CommonDataKinds.Event;
import android.provider.ContactsContract.CommonDataKinds.GroupMembership;
import android.provider.ContactsContract.CommonDataKinds.Note;
import android.provider.ContactsContract.CommonDataKinds.Organization;
import android.provider.ContactsContract.CommonDataKinds.Phone;
import android.provider.ContactsContract.CommonDataKinds.StructuredName;
import android.provider.ContactsContract.Data;
import android.provider.ContactsContract.RawContacts;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * DAS ADRESSBUCH DES TELEFONS — in beide Richtungen.
 *
 * <code>
 *   lesen      alle Kontakte des Telefons (ohne die von recreatio), damit sie
 *              ins Netz kommen (versiegelt, in den eigenen Bereich)
 *   schreiben  die Kontakte aus recreatio in ein eigenes Konto „REcreatio" des
 *              Adressbuchs — so steht bei einem Anruf der Name da, ohne dass
 *              jemand fragt; ein Abgleich schreibt nur, was sich geändert hat
 * </code>
 *
 * <p>Die geschriebenen Kontakte gehören dem Konto: man ändert sie in recreatio,
 * nicht im Adressbuch, und wer das Konto entfernt, entfernt nur sie.</p>
 */
final class PhoneContacts {

    static final String ACCOUNT_NAME = "REcreatio";
    private static final String PREFS = "recreatio.contacts";

    private PhoneContacts() {
    }

    static String accountType(Context context) {
        return context.getPackageName();
    }

    /* -- Lesen ------------------------------------------------------------------------------------ */

    /**
     * Alle Kontakte des Telefons — je Person einer (die Teile aus mehreren Konten zusammen), ohne die von recreatio.
     *
     * <p><b>Der Schlüssel sind die Kennungen der Rohkontakte</b> ({@code raw:12,raw:40}), nicht der Lookup-Key
     * des Kontakts: der ändert sich, sobald das Telefon die Abschrift aus recreatio mit dem Original
     * zusammenlegt — ein zweites Einlesen fände den Menschen dann nicht wieder.</p>
     */
    static JSONArray read(Context context) throws JSONException {
        ContentResolver cr = context.getContentResolver();
        String mine = accountType(context);
        Map<Long, String> groups = new HashMap<>();
        try (Cursor g = cr.query(ContactsContract.Groups.CONTENT_URI, new String[] { ContactsContract.Groups._ID, ContactsContract.Groups.TITLE },
                ContactsContract.Groups.DELETED + " = 0", null, null)) {
            while (g != null && g.moveToNext()) if (g.getString(1) != null) groups.put(g.getLong(0), g.getString(1));
        }

        Map<String, JSONObject> people = new LinkedHashMap<>();
        Map<String, java.util.TreeSet<Long>> raws = new HashMap<>();
        String[] columns = { Data.CONTACT_ID, Data.LOOKUP_KEY, Data.MIMETYPE, Data.DATA1, Data.DATA2, Data.DATA3, Data.DATA4, Data.DATA5, RawContacts.ACCOUNT_TYPE, Data.RAW_CONTACT_ID };
        try (Cursor c = cr.query(Data.CONTENT_URI, columns, null, null, Data.CONTACT_ID)) {
            while (c != null && c.moveToNext()) {
                String account = c.getString(8);
                if (mine.equals(account)) continue;
                String key = c.getString(1);
                if (key == null) key = "id:" + c.getLong(0);
                java.util.TreeSet<Long> ids = raws.get(key);
                if (ids == null) { ids = new java.util.TreeSet<>(); raws.put(key, ids); }
                ids.add(c.getLong(9));
                JSONObject person = people.get(key);
                if (person == null) {
                    person = new JSONObject()
                            .put("lookupKey", key).put("name", "").put("given", JSONObject.NULL).put("family", JSONObject.NULL)
                            .put("org", JSONObject.NULL).put("title", JSONObject.NULL).put("phones", new JSONArray())
                            .put("emails", new JSONArray()).put("note", JSONObject.NULL).put("birthday", JSONObject.NULL)
                            .put("groups", new JSONArray());
                    people.put(key, person);
                }
                String type = c.getString(2);
                if (type == null) continue;
                switch (type) {
                    case StructuredName.CONTENT_ITEM_TYPE:
                        if (person.optString("name").isEmpty() && c.getString(3) != null) person.put("name", c.getString(3));
                        if (person.isNull("given") && c.getString(4) != null) person.put("given", c.getString(4));
                        if (person.isNull("family") && c.getString(5) != null) person.put("family", c.getString(5));
                        break;
                    case Phone.CONTENT_ITEM_TYPE:
                        if (c.getString(3) != null) addUnique(person.getJSONArray("phones"), "number", c.getString(3), phoneLabel(c.getInt(4), c.getString(5)));
                        break;
                    case Email.CONTENT_ITEM_TYPE:
                        if (c.getString(3) != null) addUnique(person.getJSONArray("emails"), "address", c.getString(3), emailLabel(c.getInt(4), c.getString(5)));
                        break;
                    case Organization.CONTENT_ITEM_TYPE:
                        if (person.isNull("org") && c.getString(3) != null) person.put("org", c.getString(3));
                        if (person.isNull("title") && c.getString(6) != null) person.put("title", c.getString(6));
                        break;
                    case Note.CONTENT_ITEM_TYPE:
                        if (person.isNull("note") && c.getString(3) != null && !c.getString(3).trim().isEmpty()) person.put("note", c.getString(3));
                        break;
                    case Event.CONTENT_ITEM_TYPE:
                        if (c.getInt(4) == Event.TYPE_BIRTHDAY && c.getString(3) != null) person.put("birthday", c.getString(3));
                        break;
                    case GroupMembership.CONTENT_ITEM_TYPE: {
                        String title = groups.get(c.getLong(3));
                        if (title != null && !title.startsWith("System Group") && !title.equals("My Contacts") && !title.equals("Starred in Android")) {
                            JSONArray list = person.getJSONArray("groups");
                            boolean had = false;
                            for (int i = 0; i < list.length(); i++) if (list.optString(i).equals(title)) had = true;
                            if (!had) list.put(title);
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
        }

        JSONArray out = new JSONArray();
        for (Map.Entry<String, JSONObject> entry : people.entrySet()) {
            JSONObject person = entry.getValue();
            StringBuilder key = new StringBuilder();
            for (long id : raws.get(entry.getKey())) key.append(key.length() == 0 ? "" : ",").append("raw:").append(id);
            person.put("lookupKey", key.toString());
            if (person.optString("name").isEmpty()) {
                JSONArray phones = person.getJSONArray("phones");
                JSONArray emails = person.getJSONArray("emails");
                if (phones.length() > 0) person.put("name", phones.getJSONObject(0).getString("number"));
                else if (emails.length() > 0) person.put("name", emails.getJSONObject(0).getString("address"));
                else continue;
            }
            out.put(person);
        }
        return out;
    }

    private static void addUnique(JSONArray list, String field, String value, String label) throws JSONException {
        String plain = value.replaceAll("[\\s-]", "");
        for (int i = 0; i < list.length(); i++) {
            if (list.getJSONObject(i).getString(field).replaceAll("[\\s-]", "").equals(plain)) return;
        }
        list.put(new JSONObject().put(field, value).put("label", label == null ? JSONObject.NULL : label));
    }

    private static String phoneLabel(int type, String custom) {
        switch (type) {
            case Phone.TYPE_MOBILE: return "komórka";
            case Phone.TYPE_HOME: return "dom";
            case Phone.TYPE_WORK:
            case Phone.TYPE_WORK_MOBILE: return "praca";
            case Phone.TYPE_MAIN: return "główny";
            case Phone.TYPE_CUSTOM: return custom;
            default: return null;
        }
    }

    private static String emailLabel(int type, String custom) {
        switch (type) {
            case Email.TYPE_HOME: return "dom";
            case Email.TYPE_WORK: return "praca";
            case Email.TYPE_CUSTOM: return custom;
            default: return null;
        }
    }

    private static int phoneType(String label) {
        if (label == null) return Phone.TYPE_MOBILE;
        switch (label.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "komórka": case "komorka": case "mobile": case "tel. kom.": return Phone.TYPE_MOBILE;
            case "dom": case "home": case "domowy": return Phone.TYPE_HOME;
            case "praca": case "work": case "służbowy": return Phone.TYPE_WORK;
            case "główny": case "main": return Phone.TYPE_MAIN;
            default: return Phone.TYPE_CUSTOM;
        }
    }

    /* -- Schreiben -------------------------------------------------------------------------------- */

    /** Das eigene Konto im Adressbuch — einmal angelegt, sichtbar in der Liste der Kontakte. */
    static Account account(Context context) {
        Account account = new Account(ACCOUNT_NAME, accountType(context));
        AccountManager manager = AccountManager.get(context);
        boolean had = false;
        for (Account one : manager.getAccountsByType(account.type)) if (one.name.equals(ACCOUNT_NAME)) had = true;
        if (!had) {
            manager.addAccountExplicitly(account, null, null);
            ContentValues visible = new ContentValues();
            visible.put(ContactsContract.Settings.ACCOUNT_NAME, account.name);
            visible.put(ContactsContract.Settings.ACCOUNT_TYPE, account.type);
            visible.put(ContactsContract.Settings.UNGROUPED_VISIBLE, 1);
            try {
                context.getContentResolver().insert(asAdapter(ContactsContract.Settings.CONTENT_URI, account), visible);
            } catch (RuntimeException ignored) {
                // Dann sind sie nur über die Suche zu sehen — beim Anruf trotzdem.
            }
        }
        return account;
    }

    private static Uri asAdapter(Uri uri, Account account) {
        return uri.buildUpon()
                .appendQueryParameter(ContactsContract.CALLER_IS_SYNCADAPTER, "true")
                .appendQueryParameter(RawContacts.ACCOUNT_NAME, account.name)
                .appendQueryParameter(RawContacts.ACCOUNT_TYPE, account.type)
                .build();
    }

    /**
     * DER ABGLEICH: was in {@code contacts} steht, steht danach im Konto
     * „REcreatio" — neu, geändert (andere Fassung) oder entfernt (nicht mehr
     * dabei). Gleiche Fassungen bleiben unberührt.
     *
     * <p>{@code synchronized}: die App und der Läufer im Hintergrund schreiben
     * im selben Prozess — zwei Abgleiche zugleich legten denselben Kontakt
     * zweimal an.</p>
     */
    static synchronized JSONObject write(Context context, JSONArray contacts) throws Exception {
        Account account = account(context);
        ContentResolver cr = context.getContentResolver();
        Uri raw = asAdapter(RawContacts.CONTENT_URI, account);
        Uri data = asAdapter(Data.CONTENT_URI, account);

        Map<String, long[]> had = new HashMap<>();
        try (Cursor c = cr.query(RawContacts.CONTENT_URI, new String[] { RawContacts._ID, RawContacts.SOURCE_ID, RawContacts.SYNC1 },
                RawContacts.ACCOUNT_TYPE + " = ? AND " + RawContacts.ACCOUNT_NAME + " = ? AND " + RawContacts.DELETED + " = 0",
                new String[] { account.type, account.name }, null)) {
            while (c != null && c.moveToNext()) {
                String source = c.getString(1);
                if (source == null) continue;
                long version = 0;
                try { version = Long.parseLong(c.getString(2) == null ? "0" : c.getString(2)); } catch (NumberFormatException ignored) { /* 0 */ }
                had.put(source, new long[] { c.getLong(0), version });
            }
        }

        int added = 0;
        int updated = 0;
        int removed = 0;
        Set<String> seen = new HashSet<>();
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        for (int i = 0; i < contacts.length(); i++) {
            JSONObject one = contacts.getJSONObject(i);
            String id = one.getString("id");
            long version = one.optLong("version", 1);
            seen.add(id);
            long[] old = had.get(id);
            if (old != null && old[1] == version) continue;
            if (old == null) {
                int back = ops.size();
                ops.add(ContentProviderOperation.newInsert(raw)
                        .withValue(RawContacts.ACCOUNT_NAME, account.name)
                        .withValue(RawContacts.ACCOUNT_TYPE, account.type)
                        .withValue(RawContacts.SOURCE_ID, id)
                        .withValue(RawContacts.SYNC1, String.valueOf(version))
                        .build());
                rows(ops, data, one, back, -1);
                added++;
            } else {
                ops.add(ContentProviderOperation.newDelete(data)
                        .withSelection(Data.RAW_CONTACT_ID + " = ?", new String[] { String.valueOf(old[0]) }).build());
                ops.add(ContentProviderOperation.newUpdate(raw)
                        .withSelection(RawContacts._ID + " = ?", new String[] { String.valueOf(old[0]) })
                        .withValue(RawContacts.SYNC1, String.valueOf(version)).build());
                rows(ops, data, one, -1, old[0]);
                updated++;
            }
            if (ops.size() > 300) {
                cr.applyBatch(ContactsContract.AUTHORITY, ops);
                ops.clear();
            }
        }
        for (Map.Entry<String, long[]> entry : had.entrySet()) {
            if (seen.contains(entry.getKey())) continue;
            ops.add(ContentProviderOperation.newDelete(raw)
                    .withSelection(RawContacts._ID + " = ?", new String[] { String.valueOf(entry.getValue()[0]) }).build());
            removed++;
            if (ops.size() > 300) {
                cr.applyBatch(ContactsContract.AUTHORITY, ops);
                ops.clear();
            }
        }
        if (!ops.isEmpty()) cr.applyBatch(ContactsContract.AUTHORITY, ops);

        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putLong("syncedAt", System.currentTimeMillis()).putInt("written", seen.size()).apply();
        ContactIndex.invalidate();
        return new JSONObject().put("added", added).put("updated", updated).put("removed", removed).put("total", seen.size());
    }

    /**
     * Die Zeilen eines Kontakts: Name, Nummern, E-Mails, Organisation, Notiz, Geburtstag.
     *
     * <p><b>Der Name, wie er in recreatio steht</b> („Jan Kowalski (chór)"): stehen Vor- und Nachname daneben,
     * baut das Adressbuch den Namen aus ihnen und der Zusatz fehlt beim Anruf. Die Teile kommen deshalb nur
     * mit, wenn sie zusammen genau den Namen ergeben; sonst zerlegt ihn das Adressbuch selbst.</p>
     */
    private static void rows(ArrayList<ContentProviderOperation> ops, Uri data, JSONObject one, int back, long rawId) throws JSONException {
        String name = one.optString("name", "");
        String given = text(one, "given");
        String family = text(one, "family");
        String joined = ((given == null ? "" : given) + " " + (family == null ? "" : family)).trim();
        ContentProviderOperation.Builder named = row(data, back, rawId)
                .withValue(Data.MIMETYPE, StructuredName.CONTENT_ITEM_TYPE)
                .withValue(StructuredName.DISPLAY_NAME, name);
        if (!joined.isEmpty() && joined.equals(name.trim())) {
            named.withValue(StructuredName.GIVEN_NAME, given).withValue(StructuredName.FAMILY_NAME, family);
        }
        ops.add(named.build());
        JSONArray phones = one.optJSONArray("phones");
        if (phones != null) for (int i = 0; i < phones.length(); i++) {
            JSONObject p = phones.getJSONObject(i);
            String label = text(p, "label");
            int type = phoneType(label);
            ContentProviderOperation.Builder b = row(data, back, rawId)
                    .withValue(Data.MIMETYPE, Phone.CONTENT_ITEM_TYPE)
                    .withValue(Phone.NUMBER, p.optString("number"))
                    .withValue(Phone.TYPE, type);
            if (type == Phone.TYPE_CUSTOM) b.withValue(Phone.LABEL, label);
            ops.add(b.build());
        }
        JSONArray emails = one.optJSONArray("emails");
        if (emails != null) for (int i = 0; i < emails.length(); i++) {
            JSONObject e = emails.getJSONObject(i);
            String label = text(e, "label");
            ContentProviderOperation.Builder b = row(data, back, rawId)
                    .withValue(Data.MIMETYPE, Email.CONTENT_ITEM_TYPE)
                    .withValue(Email.ADDRESS, e.optString("address"))
                    .withValue(Email.TYPE, label == null ? Email.TYPE_OTHER : Email.TYPE_CUSTOM);
            if (label != null) b.withValue(Email.LABEL, label);
            ops.add(b.build());
        }
        if (text(one, "org") != null || text(one, "title") != null) {
            ops.add(row(data, back, rawId)
                    .withValue(Data.MIMETYPE, Organization.CONTENT_ITEM_TYPE)
                    .withValue(Organization.COMPANY, text(one, "org"))
                    .withValue(Organization.TITLE, text(one, "title"))
                    .withValue(Organization.TYPE, Organization.TYPE_WORK)
                    .build());
        }
        if (text(one, "note") != null) {
            ops.add(row(data, back, rawId).withValue(Data.MIMETYPE, Note.CONTENT_ITEM_TYPE).withValue(Note.NOTE, text(one, "note")).build());
        }
        if (text(one, "birthday") != null) {
            ops.add(row(data, back, rawId)
                    .withValue(Data.MIMETYPE, Event.CONTENT_ITEM_TYPE)
                    .withValue(Event.START_DATE, text(one, "birthday"))
                    .withValue(Event.TYPE, Event.TYPE_BIRTHDAY)
                    .build());
        }
    }

    private static ContentProviderOperation.Builder row(Uri data, int back, long rawId) {
        ContentProviderOperation.Builder b = ContentProviderOperation.newInsert(data);
        return back >= 0 ? b.withValueBackReference(Data.RAW_CONTACT_ID, back) : b.withValue(Data.RAW_CONTACT_ID, rawId);
    }

    private static String text(JSONObject o, String name) {
        if (o.isNull(name)) return null;
        String v = o.optString(name, "").trim();
        return v.isEmpty() ? null : v;
    }

    /* -- Die Originale im Gerät ----------------------------------------------------------------- */

    /**
     * PRZENIEŚ: Kontakte, die NUR im Gerät stehen (ohne Konto) und schon in recreatio sind, aus dem
     * Gerät entfernen — danach gibt es von ihnen nur noch die Abschrift aus recreatio, und beim Anruf
     * steht der Name, wie er dort heisst.
     *
     * <p>{@code keys} sind die Schlüssel aus recreatio ({@code raw:12}); entfernt wird nur, wessen
     * Rohkontakt KEIN Konto hat (oder das lokale Konto des Geräts, Android 14+): ein Kontakt von DAVx5,
     * Signal oder einer SIM bleibt, wo er ist — sein Entfernen ginge an einen fremden Dienst.</p>
     */
    static synchronized JSONObject dropLocal(Context context, JSONArray keys) throws Exception {
        Set<Long> wanted = new HashSet<>();
        for (int i = 0; i < keys.length(); i++) {
            for (String part : keys.optString(i, "").split(",")) {
                String p = part.trim();
                if (!p.startsWith("raw:")) continue;
                try { wanted.add(Long.parseLong(p.substring(4))); } catch (NumberFormatException ignored) { /* kein Schlüssel */ }
            }
        }
        String localType = null;
        String localName = null;
        if (android.os.Build.VERSION.SDK_INT >= 34) {
            localType = RawContacts.getLocalAccountType(context);
            localName = RawContacts.getLocalAccountName(context);
        }

        ContentResolver cr = context.getContentResolver();
        ArrayList<ContentProviderOperation> ops = new ArrayList<>();
        int removed = 0;
        try (Cursor c = cr.query(RawContacts.CONTENT_URI, new String[] { RawContacts._ID, RawContacts.ACCOUNT_TYPE, RawContacts.ACCOUNT_NAME },
                RawContacts.DELETED + " = 0", null, null)) {
            while (c != null && c.moveToNext()) {
                long id = c.getLong(0);
                if (!wanted.contains(id)) continue;
                String type = c.getString(1);
                String name = c.getString(2);
                boolean local = (type == null && name == null)
                        || (localType != null && localType.equals(type) && (localName == null || localName.equals(name)));
                if (!local) continue;
                ops.add(ContentProviderOperation.newDelete(RawContacts.CONTENT_URI)
                        .withSelection(RawContacts._ID + " = ?", new String[] { String.valueOf(id) }).build());
                removed++;
                if (ops.size() > 300) {
                    cr.applyBatch(ContactsContract.AUTHORITY, ops);
                    ops.clear();
                }
            }
        }
        if (!ops.isEmpty()) cr.applyBatch(ContactsContract.AUTHORITY, ops);
        ContactIndex.invalidate();
        return new JSONObject().put("removed", removed);
    }

    static JSONObject state(Context context) throws JSONException {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long at = prefs.getLong("syncedAt", 0);
        return new JSONObject().put("written", prefs.getInt("written", 0)).put("syncedAt", at > 0 ? at : JSONObject.NULL);
    }
}
