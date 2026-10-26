package pl.recreatio.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.Telephony;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * DER SPEICHER DER NACHRICHTEN DES TELEFONS — die Tabellen, die jede SMS-App
 * teilt ({@code content://sms}, {@code content://mms}). Als SMS-App des Telefons
 * schreibt diese App hinein, was ankommt und was hinausgeht; Google Messages
 * fände es dort wieder, wenn man zurückwechselt.
 *
 * <p>Gelesen wird für die Ansicht (Gespräche, Nachrichten, Suche), für das
 * Archiv (seitenweise ab einer Marke) und für die Meldungen.</p>
 */
final class SmsStore {

    static final Uri SMS = Telephony.Sms.CONTENT_URI;
    static final Uri MMS = Telephony.Mms.CONTENT_URI;
    static final Uri MMS_PART = Uri.parse("content://mms/part");
    private static final Uri CONVERSATIONS = Uri.parse("content://mms-sms/conversations?simple=true");
    private static final Uri CANONICAL = Uri.parse("content://mms-sms/canonical-addresses");

    /** MMS-Adresskopf: von, an, Kopie. */
    static final int ADDR_FROM = 137;
    static final int ADDR_TO = 151;
    static final int ADDR_CC = 130;

    /** Wie lange etwas, das noch hinausgeht, das Archiv aufhält. */
    private static final long PENDING_MS = 24L * 3600_000L;

    private SmsStore() {
    }

    /* -- Gespräche -------------------------------------------------------------------------- */

    /** Die Adressen hinter den Nummern eines Gesprächs (die Tabelle der kanonischen Adressen). */
    static Map<Long, String> canonical(Context context) {
        Map<Long, String> out = new HashMap<>();
        try (Cursor c = context.getContentResolver().query(CANONICAL, new String[] { "_id", "address" }, null, null, null)) {
            while (c != null && c.moveToNext()) out.put(c.getLong(0), c.getString(1));
        } catch (RuntimeException ignored) {
            // Ohne sie stehen Nummern statt Namen da.
        }
        return out;
    }

    static List<String> addressesOf(String recipientIds, Map<Long, String> canonical) {
        List<String> out = new ArrayList<>();
        if (recipientIds == null) return out;
        for (String id : recipientIds.trim().split("\\s+")) {
            if (id.isEmpty()) continue;
            try {
                String a = canonical.get(Long.parseLong(id));
                if (a != null) out.add(a);
            } catch (NumberFormatException ignored) {
                // überspringen
            }
        }
        return out;
    }

    /** Die anderen in einem Gespräch — wie das Telefon das Gespräch führt. */
    static List<String> recipients(Context context, long threadId) {
        try (Cursor c = context.getContentResolver().query(CONVERSATIONS, new String[] { "_id", "recipient_ids" },
                "_id = ?", new String[] { String.valueOf(threadId) }, null)) {
            if (c != null && c.moveToFirst()) return addressesOf(c.getString(1), canonical(context));
        } catch (RuntimeException ignored) {
            // dann leer
        }
        return new ArrayList<>();
    }

    static long threadFor(Context context, Set<String> addresses) {
        return Telephony.Threads.getOrCreateThreadId(context, addresses);
    }

    private static Map<Long, Integer> unread(Context context) {
        Map<Long, Integer> out = new HashMap<>();
        ContentResolver cr = context.getContentResolver();
        try (Cursor c = cr.query(SMS, new String[] { "thread_id" }, "type = 1 AND read = 0", null, null)) {
            while (c != null && c.moveToNext()) out.merge(c.getLong(0), 1, Integer::sum);
        } catch (RuntimeException ignored) {
            // keine Zahlen
        }
        try (Cursor c = cr.query(MMS, new String[] { "thread_id" }, "msg_box = 1 AND read = 0", null, null)) {
            while (c != null && c.moveToNext()) out.merge(c.getLong(0), 1, Integer::sum);
        } catch (RuntimeException ignored) {
            // keine Zahlen
        }
        return out;
    }

    static JSONArray threads(Context context, int limit) throws JSONException {
        Map<Long, String> canonical = canonical(context);
        Map<Long, Integer> unread = unread(context);
        Map<String, String> names = ContactIndex.names(context, canonical.values());
        JSONArray out = new JSONArray();
        try (Cursor c = context.getContentResolver().query(CONVERSATIONS,
                new String[] { "_id", "date", "message_count", "recipient_ids", "snippet", "error", "has_attachment" },
                null, null, "date DESC")) {
            while (c != null && c.moveToNext() && out.length() < limit) {
                long id = c.getLong(0);
                if (c.getInt(2) == 0) continue;
                List<String> addresses = addressesOf(c.getString(3), canonical);
                JSONArray named = new JSONArray();
                for (String a : addresses) named.put(names.containsKey(a) ? names.get(a) : JSONObject.NULL);
                out.put(new JSONObject()
                        .put("threadId", String.valueOf(id))
                        .put("addresses", new JSONArray(addresses))
                        .put("names", named)
                        .put("snippet", c.getString(4) == null ? "" : c.getString(4))
                        .put("date", c.getLong(1))
                        .put("unread", unread.getOrDefault(id, 0))
                        .put("count", c.getInt(2))
                        .put("error", c.getInt(5) != 0)
                        .put("attachment", c.getInt(6) != 0));
            }
        }
        return out;
    }

    /* -- Nachrichten ---------------------------------------------------------------------------- */

    private static final String[] SMS_COLUMNS = { "_id", "thread_id", "address", "body", "date", "date_sent", "type", "read", "status", "sub_id" };
    private static final String[] MMS_COLUMNS = { "_id", "thread_id", "date", "date_sent", "msg_box", "read", "sub", "m_type", "sub_id", "st", "ct_l" };

    private static String box(int type) {
        switch (type) {
            case 1: return "in";
            case 2: return "out";
            case 3: return "draft";
            case 4: return "outbox";
            case 5: return "failed";
            case 6: return "queued";
            default: return "in";
        }
    }

    private static JSONObject smsOf(Cursor c, List<String> peers) throws JSONException {
        int type = c.getInt(6);
        int status = c.isNull(8) ? -1 : c.getInt(8);
        String state = type == 5 ? "failed" : (type == 4 || type == 6) ? "pending" : type == 2 && status == 0 ? "complete" : type == 2 && status >= 64 ? "failed" : "none";
        long sent = c.isNull(5) ? 0 : c.getLong(5);
        return new JSONObject()
                .put("id", "sms:" + c.getLong(0))
                .put("kind", "sms")
                .put("threadId", String.valueOf(c.getLong(1)))
                .put("box", box(type))
                .put("date", c.getLong(4))
                .put("sentAt", sent > 0 ? sent : JSONObject.NULL)
                .put("address", c.getString(2) == null ? JSONObject.NULL : c.getString(2))
                .put("peers", new JSONArray(peers))
                .put("body", c.getString(3) == null ? "" : c.getString(3))
                .put("subject", JSONObject.NULL)
                .put("read", c.getInt(7) != 0)
                .put("status", state)
                .put("subId", c.isNull(9) ? JSONObject.NULL : c.getInt(9))
                .put("parts", new JSONArray())
                .put("pending", false);
    }

    /** Eine MMS, mit Text, Teilen und Absender. {@code sized}: die Grösse jedes Teils messen (für das Archiv). */
    private static JSONObject mmsOf(Context context, Cursor c, List<String> peers, boolean sized) throws JSONException {
        long id = c.getLong(0);
        int msgBox = c.getInt(4);
        int mType = c.isNull(7) ? 132 : c.getInt(7);
        StringBuilder body = new StringBuilder();
        JSONArray parts = new JSONArray();
        ContentResolver cr = context.getContentResolver();
        try (Cursor p = cr.query(MMS_PART, new String[] { "_id", "ct", "name", "fn", "cl", "text", "chset" },
                "mid = ?", new String[] { String.valueOf(id) }, "seq")) {
            while (p != null && p.moveToNext()) {
                String type = p.getString(1) == null ? "application/octet-stream" : p.getString(1).toLowerCase(java.util.Locale.ROOT);
                if (type.equals("application/smil")) continue;
                if (type.startsWith("text/plain") || type.equals("text/html")) {
                    String text = p.getString(5);
                    if (text == null) text = readText(context, p.getLong(0));
                    if (text != null && !text.isEmpty()) {
                        if (body.length() > 0) body.append('\n');
                        body.append(text);
                    }
                    continue;
                }
                String name = p.getString(2) != null ? p.getString(2) : p.getString(3) != null ? p.getString(3) : p.getString(4);
                parts.put(new JSONObject()
                        .put("partId", String.valueOf(p.getLong(0)))
                        .put("type", type)
                        .put("name", name == null ? JSONObject.NULL : name)
                        .put("size", sized ? partSize(context, p.getLong(0)) : 0));
            }
        } catch (RuntimeException ignored) {
            // Eine MMS ohne lesbare Teile bleibt mit dem, was da ist.
        }

        String from = null;
        try (Cursor a = cr.query(Uri.parse("content://mms/" + id + "/addr"), new String[] { "address", "type" }, "type = " + ADDR_FROM, null, null)) {
            if (a != null && a.moveToFirst()) from = a.getString(0);
        } catch (RuntimeException ignored) {
            // ohne Absender
        }
        if ("insert-address-token".equals(from)) from = null;

        String subject = c.getString(6);
        boolean pending = mType == 130;
        String state = msgBox == 5 ? "failed" : msgBox == 4 ? "pending" : "none";
        long date = c.getLong(2) * 1000L;
        long sent = c.isNull(3) ? 0 : c.getLong(3) * 1000L;
        return new JSONObject()
                .put("id", "mms:" + id)
                .put("kind", "mms")
                .put("threadId", String.valueOf(c.getLong(1)))
                .put("box", box(msgBox))
                .put("date", date)
                .put("sentAt", sent > 0 ? sent : JSONObject.NULL)
                .put("address", from == null ? JSONObject.NULL : from)
                .put("peers", new JSONArray(peers))
                .put("body", pending ? "" : body.toString())
                .put("subject", subject == null || subject.isEmpty() ? JSONObject.NULL : subject)
                .put("read", c.getInt(5) != 0)
                .put("status", state)
                .put("subId", c.isNull(8) ? JSONObject.NULL : c.getInt(8))
                .put("parts", parts)
                .put("pending", pending);
    }

    private static String readText(Context context, long partId) {
        try (InputStream in = context.getContentResolver().openInputStream(Uri.withAppendedPath(MMS_PART, String.valueOf(partId)))) {
            if (in == null) return null;
            return new String(readAll(in, 1_000_000), java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static long partSize(Context context, long partId) {
        try (ParcelFileDescriptor fd = context.getContentResolver().openFileDescriptor(Uri.withAppendedPath(MMS_PART, String.valueOf(partId)), "r")) {
            return fd == null ? 0 : Math.max(0, fd.getStatSize());
        } catch (IOException | RuntimeException e) {
            return 0;
        }
    }

    static byte[] readAll(InputStream in, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        int read;
        while ((read = in.read(buffer)) > 0) {
            out.write(buffer, 0, read);
            if (out.size() > max) throw new IOException("too big");
        }
        return out.toByteArray();
    }

    /** Die Nachrichten eines Gesprächs vor {@code before} (ms) — die jüngsten {@code limit}, aufsteigend. */
    static JSONObject messages(Context context, long threadId, long before, int limit) throws JSONException {
        List<String> peers = recipients(context, threadId);
        List<JSONObject> all = new ArrayList<>();
        ContentResolver cr = context.getContentResolver();
        try (Cursor c = cr.query(SMS, SMS_COLUMNS, "thread_id = ? AND date < ? AND type <> 3",
                new String[] { String.valueOf(threadId), String.valueOf(before) }, "date DESC")) {
            while (c != null && c.moveToNext() && all.size() < limit + 1) all.add(smsOf(c, peers));
        }
        int smsCount = all.size();
        try (Cursor c = cr.query(MMS, MMS_COLUMNS, "thread_id = ? AND date < ? AND msg_box <> 3",
                new String[] { String.valueOf(threadId), String.valueOf(before / 1000L + 1) }, "date DESC")) {
            int taken = 0;
            while (c != null && c.moveToNext() && taken < limit + 1) {
                if (c.getLong(2) * 1000L >= before) continue;
                all.add(mmsOf(context, c, peers, false));
                taken++;
            }
        }
        Collections.sort(all, (a, b) -> Long.compare(b.optLong("date"), a.optLong("date")));
        boolean more = all.size() > limit || smsCount > limit;
        List<JSONObject> page = all.subList(0, Math.min(limit, all.size()));
        JSONArray out = new JSONArray();
        Set<String> people = new LinkedHashSet<>(peers);
        for (int i = page.size() - 1; i >= 0; i--) {
            out.put(page.get(i));
            String from = page.get(i).optString("address", "");
            if (!from.isEmpty() && !page.get(i).isNull("address")) people.add(from);
        }
        JSONObject names = new JSONObject();
        for (Map.Entry<String, String> one : ContactIndex.names(context, people).entrySet()) names.put(one.getKey(), one.getValue());
        return new JSONObject().put("messages", out).put("more", more).put("peers", new JSONArray(peers)).put("names", names);
    }

    static JSONObject one(Context context, String id) throws JSONException {
        ContentResolver cr = context.getContentResolver();
        if (id.startsWith("sms:")) {
            try (Cursor c = cr.query(Uri.withAppendedPath(SMS, id.substring(4)), SMS_COLUMNS, null, null, null)) {
                if (c != null && c.moveToFirst()) return smsOf(c, recipients(context, c.getLong(1)));
            }
        } else if (id.startsWith("mms:")) {
            try (Cursor c = cr.query(Uri.withAppendedPath(MMS, id.substring(4)), MMS_COLUMNS, null, null, null)) {
                if (c != null && c.moveToFirst()) return mmsOf(context, c, recipients(context, c.getLong(1)), false);
            }
        }
        return null;
    }

    static boolean remove(Context context, String id) {
        ContentResolver cr = context.getContentResolver();
        if (id.startsWith("sms:")) return cr.delete(Uri.withAppendedPath(SMS, id.substring(4)), null, null) > 0;
        if (id.startsWith("mms:")) return cr.delete(Uri.withAppendedPath(MMS, id.substring(4)), null, null) > 0;
        return false;
    }

    /**
     * NICHT GESENDETES (2026-10-26): fehlgeschlagen oder hängengeblieben (Ausgang, Warteschlange,
     * ein Bericht „nicht zugestellt"), älter als {@code before} (ms) — in einem Gespräch
     * ({@code thread} ≥ 0) oder überall. {@code dry}: nur zählen; sonst löschen (nur die SMS-App darf das).
     *
     * <p>Gelöscht wird jede für sich ({@code content://sms/<id>}): nur so rechnet das Telefon das Gespräch
     * neu (letzte Nachricht, ⚠, Anzahl). Ein Löschen mit Bedingung sucht die Gespräche erst danach —
     * dann sind die Nachrichten schon fort, und die Liste zeigte weiter die gelöschte als letzte.</p>
     */
    static int unsent(Context context, long before, long thread, boolean dry) {
        ContentResolver cr = context.getContentResolver();
        String inThread = thread >= 0 ? " AND thread_id = " + thread : "";
        String sms = "(type IN (4, 5, 6) OR (type = 2 AND status >= 64)) AND date < " + before + inThread;
        String mms = "msg_box IN (4, 5) AND date < " + (before / 1000) + inThread;
        int n = 0;
        try {
            for (String id : ids(cr, SMS, sms)) n += dry ? 1 : cr.delete(Uri.withAppendedPath(SMS, id), null, null);
            for (String id : ids(cr, MMS, mms)) n += dry ? 1 : cr.delete(Uri.withAppendedPath(MMS, id), null, null);
        } catch (RuntimeException ignored) {
            // Dann eben nicht (z. B. gerade nicht die SMS-App).
        }
        return n;
    }

    private static List<String> ids(ContentResolver cr, Uri uri, String where) {
        List<String> out = new ArrayList<>();
        try (Cursor c = cr.query(uri, new String[] { "_id" }, where, null, null)) {
            while (c != null && c.moveToNext()) out.add(c.getString(0));
        }
        return out;
    }

    /** Ein ganzes Gespräch fort — SMS und MMS (nur die SMS-App des Telefons darf das). */
    static int deleteThread(Context context, long threadId) {
        return context.getContentResolver().delete(Uri.parse("content://mms-sms/conversations/" + threadId), null, null);
    }

    /** Über welche Karte zuletzt etwas in diesem Gespräch ankam — oder -1. */
    static int lastIncomingSub(Context context, long threadId) {
        try (Cursor c = context.getContentResolver().query(SMS, new String[] { "sub_id" }, "thread_id = ? AND type = 1",
                new String[] { String.valueOf(threadId) }, "date DESC LIMIT 1")) {
            if (c != null && c.moveToFirst() && !c.isNull(0)) return c.getInt(0);
        } catch (RuntimeException ignored) {
            // ohne Karte
        }
        return -1;
    }

    static void markRead(Context context, long threadId) {
        ContentValues read = new ContentValues();
        read.put("read", 1);
        read.put("seen", 1);
        ContentResolver cr = context.getContentResolver();
        String[] args = { String.valueOf(threadId) };
        try {
            cr.update(SMS, read, "thread_id = ? AND (read = 0 OR seen = 0)", args);
            cr.update(MMS, read, "thread_id = ? AND (read = 0 OR seen = 0)", args);
        } catch (RuntimeException ignored) {
            // Dann bleibt es ungelesen.
        }
    }

    /** Die Daten eines Teils einer MMS, als Base64 — höchstens {@code max} Bytes. */
    static JSONObject part(Context context, long partId, int max) throws JSONException, IOException {
        ContentResolver cr = context.getContentResolver();
        String type = "application/octet-stream";
        try (Cursor c = cr.query(MMS_PART, new String[] { "ct" }, "_id = ?", new String[] { String.valueOf(partId) }, null)) {
            if (c != null && c.moveToFirst() && c.getString(0) != null) type = c.getString(0);
        }
        try (InputStream in = cr.openInputStream(Uri.withAppendedPath(MMS_PART, String.valueOf(partId)))) {
            if (in == null) throw new IOException("no part");
            byte[] data = readAll(in, max);
            return new JSONObject().put("type", type).put("data", Base64.encodeToString(data, Base64.NO_WRAP));
        }
    }

    /* -- Suchen ---------------------------------------------------------------------------------- */

    static JSONArray search(Context context, String query, int limit) throws JSONException {
        String like = "%" + query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        JSONArray out = new JSONArray();
        ContentResolver cr = context.getContentResolver();
        try (Cursor c = cr.query(SMS, new String[] { "_id", "thread_id", "date", "body", "address" },
                "body LIKE ? ESCAPE '\\' AND type <> 3", new String[] { like }, "date DESC")) {
            while (c != null && c.moveToNext() && out.length() < limit) {
                out.put(new JSONObject()
                        .put("threadId", String.valueOf(c.getLong(1)))
                        .put("id", "sms:" + c.getLong(0))
                        .put("date", c.getLong(2))
                        .put("snippet", c.getString(3) == null ? "" : c.getString(3))
                        .put("address", c.getString(4) == null ? JSONObject.NULL : c.getString(4)));
            }
        }
        if (out.length() < limit) {
            try (Cursor p = cr.query(MMS_PART, new String[] { "mid", "text" }, "ct = 'text/plain' AND text LIKE ? ESCAPE '\\'",
                    new String[] { like }, null)) {
                while (p != null && p.moveToNext() && out.length() < limit) {
                    try (Cursor m = cr.query(Uri.withAppendedPath(MMS, String.valueOf(p.getLong(0))), new String[] { "_id", "thread_id", "date" }, null, null, null)) {
                        if (m == null || !m.moveToFirst()) continue;
                        out.put(new JSONObject()
                                .put("threadId", String.valueOf(m.getLong(1)))
                                .put("id", "mms:" + m.getLong(0))
                                .put("date", m.getLong(2) * 1000L)
                                .put("snippet", p.getString(1) == null ? "" : p.getString(1))
                                .put("address", JSONObject.NULL));
                    }
                }
            } catch (RuntimeException ignored) {
                // MMS-Text lässt sich nicht durchsuchen — dann nur SMS.
            }
        }
        return out;
    }

    /* -- Namen ------------------------------------------------------------------------------------ */

    /** Wie die Nummern im Adressbuch des Telefons heissen (auch die von recreatio geschriebenen) — {@link ContactIndex}. */
    static JSONObject names(Context context, JSONArray numbers) throws JSONException {
        List<String> list = new ArrayList<>();
        for (int i = 0; i < numbers.length(); i++) list.add(numbers.optString(i, ""));
        JSONObject out = new JSONObject();
        for (Map.Entry<String, String> one : ContactIndex.names(context, list).entrySet()) out.put(one.getKey(), one.getValue());
        return out;
    }

    static String nameOf(Context context, String number) {
        if (number == null) return null;
        try {
            JSONObject found = names(context, new JSONArray().put(number));
            return found.optString(number, null);
        } catch (JSONException e) {
            return null;
        }
    }

    /* -- Schreiben: was ankommt, was hinausgeht -------------------------------------------------- */

    static Uri insertInbox(Context context, String address, String body, long sentAt, int subId) {
        ContentValues v = new ContentValues();
        v.put("address", address);
        v.put("body", body);
        v.put("date", System.currentTimeMillis());
        if (sentAt > 0) v.put("date_sent", sentAt);
        v.put("read", 0);
        v.put("seen", 0);
        v.put("type", 1);
        if (subId >= 0) v.put("sub_id", subId);
        return context.getContentResolver().insert(Telephony.Sms.Inbox.CONTENT_URI, v);
    }

    static Uri insertOutbox(Context context, String address, String body, int subId, long threadId) {
        ContentValues v = new ContentValues();
        v.put("address", address);
        v.put("body", body);
        v.put("date", System.currentTimeMillis());
        v.put("read", 1);
        v.put("seen", 1);
        v.put("type", 4);
        v.put("status", -1);
        if (threadId > 0) v.put("thread_id", threadId);
        if (subId >= 0) v.put("sub_id", subId);
        return context.getContentResolver().insert(Telephony.Sms.CONTENT_URI, v);
    }

    static void smsResult(Context context, Uri uri, boolean ok, int errorCode) {
        ContentValues v = new ContentValues();
        v.put("type", ok ? 2 : 5);
        if (!ok) v.put("error_code", errorCode);
        try {
            context.getContentResolver().update(uri, v, null, null);
        } catch (RuntimeException ignored) {
            // Die Nachricht bleibt im Ausgang stehen.
        }
    }

    static long threadOf(Context context, Uri message) {
        if (message == null) return -1;
        try (Cursor c = context.getContentResolver().query(message, new String[] { "thread_id" }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getLong(0);
        } catch (RuntimeException ignored) {
            // unbekannt
        }
        return -1;
    }

    /**
     * Eine MMS in den Speicher — eine geladene (Eingang) oder eine, die
     * hinausgeht (Ausgang): Zeile, Adressen, Teile (Text in der Zeile, Bytes
     * als Datei des Speichers).
     */
    static Uri insertMms(Context context, MmsPdu.Message m, int msgBox, int subId, Set<String> threadAddresses, boolean read) {
        ContentResolver cr = context.getContentResolver();
        long threadId = threadFor(context, threadAddresses.isEmpty() ? Collections.singleton(m.from == null ? "unknown" : m.from) : threadAddresses);
        ContentValues v = new ContentValues();
        v.put("thread_id", threadId);
        v.put("date", m.date > 0 ? m.date : System.currentTimeMillis() / 1000L);
        v.put("date_sent", m.date);
        v.put("msg_box", msgBox);
        v.put("read", read ? 1 : 0);
        v.put("seen", read ? 1 : 0);
        v.put("m_type", msgBox == 1 ? MmsPdu.RETRIEVE_CONF : MmsPdu.SEND_REQ);
        v.put("v", m.version);
        if (m.messageId != null) v.put("m_id", m.messageId);
        if (m.transactionId != null) v.put("tr_id", m.transactionId);
        v.put("ct_t", m.contentType == null ? "application/vnd.wap.multipart.related" : m.contentType);
        if (m.subject != null) { v.put("sub", m.subject); v.put("sub_cs", 106); }
        v.put("m_cls", m.messageClass == null ? "personal" : m.messageClass);
        v.put("pri", m.priority == 0 ? 0x81 : m.priority);
        v.put("text_only", hasMedia(m) ? 0 : 1);
        if (subId >= 0) v.put("sub_id", subId);
        Uri box = msgBox == 1 ? Telephony.Mms.Inbox.CONTENT_URI : msgBox == 4 ? Telephony.Mms.Outbox.CONTENT_URI : MMS;
        Uri row = cr.insert(box, v);
        if (row == null) return null;
        String id = row.getLastPathSegment();

        Uri addr = Uri.parse("content://mms/" + id + "/addr");
        if (msgBox == 1) {
            if (m.from != null) addAddress(cr, addr, m.from, ADDR_FROM);
            for (String to : m.to) addAddress(cr, addr, to, ADDR_TO);
            for (String cc : m.cc) addAddress(cr, addr, cc, ADDR_CC);
        } else {
            addAddress(cr, addr, "insert-address-token", ADDR_FROM);
            for (String to : m.to) addAddress(cr, addr, to, ADDR_TO);
        }

        Uri partUri = Uri.parse("content://mms/" + id + "/part");
        int seq = 0;
        for (MmsPdu.Part p : m.parts) {
            ContentValues pv = new ContentValues();
            pv.put("seq", p.isSmil() ? -1 : seq++);
            pv.put("ct", p.type);
            if (p.name != null) pv.put("name", p.name);
            if (p.filename != null) pv.put("fn", p.filename);
            if (p.contentId != null) pv.put("cid", p.contentId);
            if (p.contentLocation != null) pv.put("cl", p.contentLocation);
            if (p.isText() || p.isSmil()) {
                pv.put("chset", 106);
                pv.put("text", p.text());
                cr.insert(partUri, pv);
                continue;
            }
            Uri written = cr.insert(partUri, pv);
            if (written == null) continue;
            try (OutputStream out = cr.openOutputStream(written)) {
                if (out != null) out.write(p.data);
            } catch (IOException | RuntimeException ignored) {
                // Ein Teil ohne Bytes ist besser als keine Nachricht.
            }
        }
        return row;
    }

    private static boolean hasMedia(MmsPdu.Message m) {
        for (MmsPdu.Part p : m.parts) if (!p.isText() && !p.isSmil()) return true;
        return false;
    }

    private static void addAddress(ContentResolver cr, Uri addr, String address, int type) {
        ContentValues v = new ContentValues();
        v.put("address", address);
        v.put("type", type);
        v.put("charset", 106);
        try {
            cr.insert(addr, v);
        } catch (RuntimeException ignored) {
            // Eine Adresse weniger.
        }
    }

    /** Eine angekündigte, noch nicht geladene MMS — damit sie dasteht (und sich nachladen lässt). */
    static Uri insertMmsNotice(Context context, MmsPdu.Message notice, int subId) {
        ContentResolver cr = context.getContentResolver();
        Set<String> who = new LinkedHashSet<>();
        who.add(notice.from == null ? "unknown" : notice.from);
        ContentValues v = new ContentValues();
        v.put("thread_id", threadFor(context, who));
        v.put("date", System.currentTimeMillis() / 1000L);
        v.put("msg_box", 1);
        v.put("read", 0);
        v.put("seen", 0);
        v.put("m_type", MmsPdu.NOTIFICATION_IND);
        v.put("v", notice.version);
        if (notice.transactionId != null) v.put("tr_id", notice.transactionId);
        if (notice.contentLocation != null) v.put("ct_l", notice.contentLocation);
        if (notice.subject != null) { v.put("sub", notice.subject); v.put("sub_cs", 106); }
        v.put("m_size", notice.size);
        v.put("exp", notice.expiry);
        v.put("m_cls", notice.messageClass == null ? "personal" : notice.messageClass);
        if (subId >= 0) v.put("sub_id", subId);
        Uri row = cr.insert(Telephony.Mms.Inbox.CONTENT_URI, v);
        if (row != null && notice.from != null) addAddress(cr, Uri.parse("content://mms/" + row.getLastPathSegment() + "/addr"), notice.from, ADDR_FROM);
        return row;
    }

    static void mmsResult(Context context, Uri row, boolean ok, String messageId) {
        ContentValues v = new ContentValues();
        v.put("msg_box", ok ? 2 : 5);
        if (messageId != null) v.put("m_id", messageId);
        try {
            context.getContentResolver().update(row, v, null, null);
        } catch (RuntimeException ignored) {
            // Sie bleibt im Ausgang stehen.
        }
    }

    /* -- Für das Archiv: seitenweise ab einer Marke --------------------------------------------- */

    /**
     * Eine Seite für das Archiv: erst die SMS nach {@code afterSms}, dann die MMS
     * nach {@code afterMms}, der Reihe nach. Was gerade hinausgeht (jünger als
     * ein Tag), hält die Marke auf — es kommt, sobald es entschieden ist.
     */
    static JSONObject exportPage(Context context, long threadId, long afterSms, long afterMms, int limit) throws JSONException {
        ContentResolver cr = context.getContentResolver();
        JSONArray messages = new JSONArray();
        Map<Long, List<String>> peers = new HashMap<>();
        long since = System.currentTimeMillis() - PENDING_MS;
        /* Ein Gespräch (`threadId` ≥ 0) oder das ganze Telefon. */
        String inThread = threadId >= 0 ? " AND thread_id = " + threadId : "";

        long smsBlock = Long.MAX_VALUE;
        try (Cursor c = cr.query(SMS, new String[] { "_id" }, "_id > ? AND type IN (4, 6) AND date > ?" + inThread,
                new String[] { String.valueOf(afterSms), String.valueOf(since) }, "_id ASC")) {
            if (c != null && c.moveToFirst()) smsBlock = c.getLong(0);
        }
        long nextSms = afterSms;
        boolean smsDone = true;
        try (Cursor c = cr.query(SMS, SMS_COLUMNS, "_id > ? AND _id < ? AND type <> 3" + inThread,
                new String[] { String.valueOf(afterSms), String.valueOf(smsBlock) }, "_id ASC")) {
            while (c != null && c.moveToNext()) {
                if (messages.length() >= limit) { smsDone = false; break; }
                long thread = c.getLong(1);
                messages.put(smsOf(c, peers.computeIfAbsent(thread, t -> recipients(context, t))));
                nextSms = c.getLong(0);
            }
        }

        long nextMms = afterMms;
        boolean mmsDone = true;
        long mmsBlock = Long.MAX_VALUE;
        if (smsDone && messages.length() < limit) {
            try (Cursor c = cr.query(MMS, new String[] { "_id" }, "_id > ? AND (msg_box = 4 OR m_type = 130) AND date > ?" + inThread,
                    new String[] { String.valueOf(afterMms), String.valueOf(since / 1000L) }, "_id ASC")) {
                if (c != null && c.moveToFirst()) mmsBlock = c.getLong(0);
            }
            try (Cursor c = cr.query(MMS, MMS_COLUMNS, "_id > ? AND _id < ? AND msg_box <> 3" + inThread,
                    new String[] { String.valueOf(afterMms), String.valueOf(mmsBlock) }, "_id ASC")) {
                while (c != null && c.moveToNext()) {
                    if (messages.length() >= limit) { mmsDone = false; break; }
                    nextMms = c.getLong(0);
                    if (!c.isNull(7) && c.getInt(7) == 130) continue;
                    long thread = c.getLong(1);
                    messages.put(mmsOf(context, c, peers.computeIfAbsent(thread, t -> recipients(context, t)), true));
                }
            }
        } else {
            mmsDone = false;
        }

        /* `blocked`: es hielt etwas an, das noch hinausgeht (oder noch geladen wird) — später noch einmal. */
        return new JSONObject()
                .put("messages", messages)
                .put("nextSms", nextSms)
                .put("nextMms", nextMms)
                .put("done", smsDone && mmsDone)
                .put("blocked", smsBlock != Long.MAX_VALUE || mmsBlock != Long.MAX_VALUE);
    }

    /** Die Nummern, die zu einer Menge gehören — ohne Doppelte, in der Reihenfolge. */
    static Set<String> setOf(Iterable<String> numbers) {
        Set<String> out = new LinkedHashSet<>();
        for (String n : numbers) if (n != null && !n.trim().isEmpty()) out.add(n.trim());
        return out;
    }

    static Set<String> without(Set<String> all, Set<String> mine) {
        Set<String> out = new HashSet<>(all);
        out.removeAll(mine);
        return out;
    }
}
