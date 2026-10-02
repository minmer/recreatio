package pl.recreatio.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * WAS DAS TELEFON ZEIGT (0076) — die Meldungen mit Inhalt.
 *
 * <p>Den Inhalt öffnet die Seite ({@code notifyRich.ts}: vorn die App, im
 * Hintergrund der Läufer, {@link RunnerHost}); hier wird er gezeigt:</p>
 *
 * <code>
 *   Rozmowa      ein Gespräch (MessagingStyle): wer, was, wann; „Odpowiedz"
 *                mit Antwortfeld und „Przeczytane"
 *   Formularz    die neuen Einsendungen mit Namen
 *   Linki        wer über einen Link kam
 * </code>
 *
 * <p><b>Was neu klingelt, entscheidet nur diese Klasse</b> — sie weiss, welche
 * Nachrichten schon zu sehen waren. Die Seite und der Läufer liefern einfach
 * den ganzen Stand; was schon da war, wird still aktualisiert, was ein
 * Mensch weggewischt hat, kommt erst mit etwas Neuem wieder.</p>
 *
 * <p><b>Auf dem Sperrbildschirm</b> steht nur „Nowa wiadomość" (öffentliche
 * Fassung), wenn das Telefon vertrauliche Inhalte verbirgt.</p>
 */
final class Notices {

    static final String CHANNEL_CHAT = "chat";
    static final String CHANNEL_NEWS = "news";
    static final String CHANNEL_TASKS = "tasks";
    static final String GROUP_CHATS = "pl.recreatio.app.CHATS";
    static final String KEY_REPLY = "reply";

    /** Die Zahlen-Meldung von 0067 ({@link NotifyWorker}) — der Inhalt ersetzt sie. */
    static final int COUNTS_ID = 7700;

    private static final String PREFS = "recreatio.notices";

    private Notices() {
    }

    /* -- Kennungen ------------------------------------------------------------ */

    /**
     * Die Nummer einer Marke — dieselbe wie {@code numberOf} in platform.ts
     * (FNV-1a, 31 Bit): so ersetzt diese Meldung die der Seite für dieselbe Rozmowa.
     */
    static int numberOf(String tag) {
        int hash = 0x811c9dc5;
        for (int i = 0; i < tag.length(); i++) {
            hash ^= tag.charAt(i);
            hash *= 0x01000193;
        }
        int n = hash >>> 1;
        return n == 0 ? 1 : n;
    }

    /** UUIDv7 wie {@code ids.ts}: die Kennung einer Antwort entsteht hier, damit ein zweiter Versuch nicht doppelt schickt. */
    static String newId() {
        long ms = System.currentTimeMillis();
        UUID random = UUID.randomUUID();
        long high = (ms << 16) | 0x7000L | (random.getMostSignificantBits() & 0x0fffL);
        long low = (random.getLeastSignificantBits() & 0x3fffffffffffffffL) | 0x8000000000000000L;
        return new UUID(high, low).toString();
    }

    /* -- Kanäle und Erlaubnis --------------------------------------------------- */

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL_CHAT) == null) {
            NotificationChannel chat = new NotificationChannel(CHANNEL_CHAT, "Rozmowy", NotificationManager.IMPORTANCE_HIGH);
            chat.setDescription("Nowe wiadomości w rozmowach");
            manager.createNotificationChannel(chat);
        }
        if (manager.getNotificationChannel(CHANNEL_NEWS) == null) {
            NotificationChannel news = new NotificationChannel(CHANNEL_NEWS, "Nowości", NotificationManager.IMPORTANCE_DEFAULT);
            news.setDescription("Nowe zgłoszenia z formularzy i dołączenia przez linki");
            manager.createNotificationChannel(news);
        }
        if (manager.getNotificationChannel(CHANNEL_TASKS) == null) {
            NotificationChannel tasks = new NotificationChannel(CHANNEL_TASKS, "Zadania", NotificationManager.IMPORTANCE_HIGH);
            tasks.setDescription("Przypomnienia o zadaniach: na początku, w połowie, pod koniec");
            manager.createNotificationChannel(tasks);
        }
    }

    static boolean allowed(Context context) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    static void post(Context context, int id, NotificationCompat.Builder builder) {
        if (!allowed(context)) return;
        try {
            NotificationManagerCompat.from(context).notify(id, builder.build());
        } catch (SecurityException ignored) {
            // Ohne Erlaubnis keine Meldung — kein Absturz.
        }
    }

    static void cancel(Context context, int id) {
        NotificationManagerCompat.from(context).cancel(id);
    }

    /* -- Wohin ein Tippen führt ------------------------------------------------- */

    /** Die App an einer Stelle öffnen — wie ein Link auf recreatio.pl ({@code open}: die Adresse hinter der Raute). */
    static PendingIntent openIntent(Context context, String open, int code) {
        String hash = open == null || open.isEmpty() ? "#/workspace" : open;
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://recreatio.pl/" + hash), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Eine Handlung aus der Meldung ({@link ActionReceiver}). Mit Antwortfeld muss sie veränderlich sein. */
    static PendingIntent action(Context context, String action, String key, Intent extras, boolean mutable) {
        Intent intent = new Intent(context, ActionReceiver.class).setAction(action);
        intent.setData(Uri.parse("recreatio-action:" + Uri.encode(action + ":" + key)));
        if (extras != null) intent.putExtras(extras);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (mutable && Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        if (!mutable) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, numberOf(action + ":" + key), intent, flags);
    }

    /* -- Der gemerkte Stand ------------------------------------------------------- */

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject load(Context context, String key) {
        try {
            return new JSONObject(prefs(context).getString(key, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void save(Context context, String key, JSONObject value) {
        prefs(context).edit().putString(key, value.toString()).apply();
    }

    /** Was das Telefon schon zeigt: Rozmowa → Zeit ihrer letzten Nachricht (für den Läufer: das muss er nicht öffnen). */
    static synchronized JSONObject shownChats(Context context) throws JSONException {
        JSONObject chats = load(context, "chats");
        JSONObject out = new JSONObject();
        for (Iterator<String> it = chats.keys(); it.hasNext(); ) {
            String id = it.next();
            String at = chats.getJSONObject(id).optString("at", "");
            if (!at.isEmpty()) out.put(id, at);
        }
        return out;
    }

    static synchronized JSONObject shownForms(Context context) throws JSONException {
        JSONObject forms = load(context, "forms");
        JSONObject out = new JSONObject();
        for (Iterator<String> it = forms.keys(); it.hasNext(); ) {
            String id = it.next();
            out.put(id, forms.getJSONObject(id).optInt("count", 0));
        }
        return out;
    }

    static synchronized int shownLinks(Context context) {
        return load(context, "links").optInt("count", -1);
    }

    /* -- Zeigen ------------------------------------------------------------------- */

    /**
     * DER GANZE STAND, wie {@code notifyRich.News} ihn bringt: was darin fehlt,
     * ist gelesen oder vorbei und geht weg; was schon zu sehen war, bleibt still.
     */
    static synchronized void present(Context context, JSONObject news) throws JSONException {
        ensureChannels(context);
        presentChats(context, news.optJSONArray("conversations"));
        presentForms(context, news.optJSONArray("forms"));
        presentLinks(context, news.optJSONObject("links"));
        /* Der Inhalt ersetzt die blosse Zahl (0067). */
        cancel(context, COUNTS_ID);
    }

    private static void presentChats(Context context, JSONArray conversations) throws JSONException {
        JSONObject chats = load(context, "chats");
        Set<String> keep = new HashSet<>();
        if (conversations != null) {
            for (int i = 0; i < conversations.length(); i++) {
                JSONObject c = conversations.getJSONObject(i);
                String id = c.getString("chatId");
                keep.add(id);
                if (c.optBoolean("unchanged")) continue;

                JSONObject before = chats.optJSONObject(id);
                Set<String> seen = lineIds(before);
                boolean fresh = false;
                JSONArray lines = c.optJSONArray("lines");
                if (lines == null) lines = new JSONArray();
                for (int j = 0; j < lines.length(); j++) {
                    if (!seen.contains(lines.getJSONObject(j).optString("id"))) fresh = true;
                }

                JSONObject state = new JSONObject()
                        .put("at", c.optString("lastMessageAt", ""))
                        .put("title", c.optString("title", "Rozmowa"))
                        .put("group", c.optBoolean("group"))
                        .put("unread", c.optInt("unread"))
                        .put("open", c.optString("open"))
                        .put("canReply", c.optBoolean("canReply"))
                        .put("lines", lines)
                        .put("dismissed", !fresh && before != null && before.optBoolean("dismissed"));
                chats.put(id, state);
                if (fresh || !state.getBoolean("dismissed")) postChat(context, id, state, fresh);
            }
        }

        List<String> gone = new ArrayList<>();
        for (Iterator<String> it = chats.keys(); it.hasNext(); ) {
            String id = it.next();
            if (!keep.contains(id)) gone.add(id);
        }
        for (String id : gone) {
            chats.remove(id);
            cancel(context, numberOf(id));
        }
        save(context, "chats", chats);
        summary(context, chats);
    }

    private static Set<String> lineIds(JSONObject state) {
        Set<String> out = new HashSet<>();
        if (state == null) return out;
        JSONArray lines = state.optJSONArray("lines");
        if (lines == null) return out;
        for (int i = 0; i < lines.length(); i++) {
            JSONObject line = lines.optJSONObject(i);
            if (line != null) out.add(line.optString("id"));
        }
        return out;
    }

    /** Ein Gespräch: wer, was, wann — mit „Odpowiedz" und „Przeczytane". */
    private static void postChat(Context context, String chatId, JSONObject state, boolean alert) throws JSONException {
        Person me = new Person.Builder().setName("Ty").setKey("me").build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        boolean group = state.optBoolean("group");
        String title = state.optString("title", "Rozmowa");
        /* Zu zweit steht der Name schon an jeder Zeile — ein Titel daneben hiesse „Anna: Anna". */
        style.setConversationTitle(group ? title : null);
        style.setGroupConversation(group);

        JSONArray lines = state.optJSONArray("lines");
        long when = System.currentTimeMillis();
        String last = "";
        if (lines != null) {
            for (int i = 0; i < lines.length(); i++) {
                JSONObject line = lines.getJSONObject(i);
                long at = line.optLong("ms", when);
                String text = line.optString("text");
                Person who = line.optBoolean("mine") ? null
                        : new Person.Builder().setName(line.optString("author", "Ktoś")).setKey("author:" + line.optString("author")).build();
                style.addMessage(new NotificationCompat.MessagingStyle.Message(text, at, who));
                when = at;
                last = text;
            }
        }

        int unread = state.optInt("unread");
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_CHAT)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setStyle(style)
                .setContentTitle(title)
                .setContentText(last)
                .setContentIntent(openIntent(context, state.optString("open"), numberOf("open:" + chatId)))
                .setDeleteIntent(action(context, ActionReceiver.ACTION_DISMISS, chatId, chatExtras(chatId), false))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setGroup(GROUP_CHATS)
                .setWhen(when)
                .setShowWhen(true)
                .setNumber(unread)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion(context, CHANNEL_CHAT, unread <= 1 ? "Nowa wiadomość" : "Nowe wiadomości: " + unread))
                .setSilent(!alert);

        if (state.optBoolean("canReply")) {
            RemoteInput input = new RemoteInput.Builder(KEY_REPLY).setLabel("Odpowiedz").build();
            builder.addAction(new NotificationCompat.Action.Builder(R.drawable.ic_stat_recreatio, "Odpowiedz",
                    action(context, ActionReceiver.ACTION_REPLY, chatId, chatExtras(chatId), true))
                    .addRemoteInput(input)
                    .setAllowGeneratedReplies(false)
                    .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                    .setShowsUserInterface(false)
                    .build());
        }
        builder.addAction(new NotificationCompat.Action.Builder(R.drawable.ic_stat_recreatio, "Przeczytane",
                action(context, ActionReceiver.ACTION_READ, chatId, chatExtras(chatId), false))
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
                .setShowsUserInterface(false)
                .build());

        post(context, numberOf(chatId), builder);
    }

    private static Intent chatExtras(String chatId) {
        return new Intent().putExtra("chatId", chatId);
    }

    private static NotificationCompat.Builder publicBuilder(Context context, String channel, String text) {
        return new NotificationCompat.Builder(context, channel)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle("REcreatio")
                .setContentText(text);
    }

    private static android.app.Notification publicVersion(Context context, String channel, String text) {
        return publicBuilder(context, channel, text).build();
    }

    /** Ab zwei Gesprächen eine Sammelmeldung — sonst stapelt Android sie ohne Überschrift. */
    private static void summary(Context context, JSONObject chats) throws JSONException {
        int id = numberOf("chats-summary");
        List<String> shown = new ArrayList<>();
        int total = 0;
        for (Iterator<String> it = chats.keys(); it.hasNext(); ) {
            JSONObject state = chats.getJSONObject(it.next());
            if (state.optBoolean("dismissed")) continue;
            shown.add(state.optString("title"));
            total += state.optInt("unread");
        }
        if (shown.size() < 2) {
            cancel(context, id);
            return;
        }
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
        for (String title : shown) inbox.addLine(title);
        String text = "Nowe wiadomości: " + total;
        post(context, id, new NotificationCompat.Builder(context, CHANNEL_CHAT)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle(text)
                .setStyle(inbox.setSummaryText(shown.size() + " rozmowy"))
                .setGroup(GROUP_CHATS)
                .setGroupSummary(true)
                .setSilent(true)
                .setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion(context, CHANNEL_CHAT, text))
                .setContentIntent(openIntent(context, "#/workspace/chat", numberOf("open:chats"))));
    }

    private static void presentForms(Context context, JSONArray forms) throws JSONException {
        JSONObject stored = load(context, "forms");
        Set<String> keep = new HashSet<>();
        if (forms != null) {
            for (int i = 0; i < forms.length(); i++) {
                JSONObject f = forms.getJSONObject(i);
                String id = f.getString("moduleId");
                keep.add(id);
                if (f.optBoolean("unchanged")) continue;

                JSONObject before = stored.optJSONObject(id);
                JSONArray beforeIds = before == null ? new JSONArray() : before.optJSONArray("ids");
                Set<String> seen = new HashSet<>();
                if (beforeIds != null) for (int j = 0; j < beforeIds.length(); j++) seen.add(beforeIds.optString(j));

                int count = f.optInt("count");
                JSONArray entries = f.optJSONArray("entries");
                JSONArray ids = new JSONArray();
                boolean fresh = before == null || count > before.optInt("count");
                NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
                String first = null;
                if (entries != null) {
                    for (int j = 0; j < entries.length(); j++) {
                        JSONObject e = entries.getJSONObject(j);
                        String entryId = e.optString("id");
                        ids.put(entryId);
                        if (!seen.contains(entryId)) fresh = true;
                        String who = e.isNull("who") ? "Zgłoszenie" : e.optString("who", "Zgłoszenie");
                        String line = who + " · " + clock(e.optLong("ms", 0));
                        inbox.addLine(line);
                        if (first == null) first = who;
                    }
                }
                stored.put(id, new JSONObject().put("count", count).put("ids", ids));

                String name = f.optString("name", "Formularz");
                String title = count == 1 ? "Nowe zgłoszenie: " + name : "Nowe zgłoszenia (" + count + "): " + name;
                post(context, numberOf("form:" + id), new NotificationCompat.Builder(context, CHANNEL_NEWS)
                        .setSmallIcon(R.drawable.ic_stat_recreatio)
                        .setContentTitle(title)
                        .setContentText(first == null ? "Ktoś wypełnił formularz." : first)
                        .setStyle(inbox.setBigContentTitle(title))
                        .setContentIntent(openIntent(context, f.optString("open"), numberOf("open:form:" + id)))
                        .setAutoCancel(true)
                        .setCategory(NotificationCompat.CATEGORY_EVENT)
                        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                        .setPublicVersion(publicVersion(context, CHANNEL_NEWS, count == 1 ? "Nowe zgłoszenie" : "Nowe zgłoszenia: " + count))
                        .setSilent(!fresh));
            }
        }

        List<String> gone = new ArrayList<>();
        for (Iterator<String> it = stored.keys(); it.hasNext(); ) {
            String id = it.next();
            if (!keep.contains(id)) gone.add(id);
        }
        for (String id : gone) {
            stored.remove(id);
            cancel(context, numberOf("form:" + id));
        }
        save(context, "forms", stored);
    }

    private static void presentLinks(Context context, JSONObject links) throws JSONException {
        int id = numberOf("links");
        if (links == null) {
            save(context, "links", new JSONObject());
            cancel(context, id);
            return;
        }
        if (links.optBoolean("unchanged")) return;

        JSONObject before = load(context, "links");
        JSONArray beforeKeys = before.optJSONArray("keys");
        Set<String> seen = new HashSet<>();
        if (beforeKeys != null) for (int j = 0; j < beforeKeys.length(); j++) seen.add(beforeKeys.optString(j));

        int count = links.optInt("count");
        boolean fresh = count > before.optInt("count", 0);
        JSONArray joined = links.optJSONArray("joined");
        JSONArray keys = new JSONArray();
        NotificationCompat.InboxStyle inbox = new NotificationCompat.InboxStyle();
        String first = null;
        if (joined != null) {
            for (int j = 0; j < joined.length(); j++) {
                JSONObject one = joined.getJSONObject(j);
                keys.put(one.optString("key"));
                if (!seen.contains(one.optString("key"))) fresh = true;
                String who = one.isNull("name") ? "Ktoś" : one.optString("name", "Ktoś");
                StringBuilder line = new StringBuilder(who);
                if (!one.isNull("label") && !one.optString("label").isEmpty()) line.append(" · „").append(one.optString("label")).append("\"");
                if (!one.isNull("area") && !one.optString("area").isEmpty()) line.append(" · ").append(one.optString("area"));
                inbox.addLine(line);
                if (first == null) first = line.toString();
            }
        }
        save(context, "links", new JSONObject().put("count", count).put("keys", keys));

        String title = count == 1 ? "Ktoś dołączył przez link" : "Dołączenia przez linki: " + count;
        post(context, id, new NotificationCompat.Builder(context, CHANNEL_NEWS)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle(title)
                .setContentText(first == null ? "Zobacz linki dostępu w Obszarach." : first)
                .setStyle(inbox.setBigContentTitle(title))
                .setContentIntent(openIntent(context, links.optString("open"), numberOf("open:links")))
                .setAutoCancel(true)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(publicVersion(context, CHANNEL_NEWS, title))
                .setSilent(!fresh));
    }

    /** „14:05" in der Zeit des Telefons. */
    private static String clock(long ms) {
        if (ms <= 0) return "";
        return new java.text.SimpleDateFormat("HH:mm", java.util.Locale.ROOT).format(new java.util.Date(ms));
    }

    /* -- Was der Mensch an der Meldung tut ----------------------------------------- */

    /** Weggewischt: erst mit etwas Neuem wieder zeigen. */
    static synchronized void dismissed(Context context, String chatId) throws JSONException {
        JSONObject chats = load(context, "chats");
        JSONObject state = chats.optJSONObject(chatId);
        if (state == null) return;
        state.put("dismissed", true);
        save(context, "chats", chats);
        summary(context, chats);
    }

    /** Die Rozmowa ist offen oder gelesen: Meldung weg, Stand vergessen. */
    static synchronized void dismissChat(Context context, String chatId) throws JSONException {
        JSONObject chats = load(context, "chats");
        chats.remove(chatId);
        save(context, "chats", chats);
        cancel(context, numberOf(chatId));
        summary(context, chats);
    }

    /** Die Seite sagt, welche Rozmowy noch Ungelesenes haben — die übrigen gehen weg. */
    static synchronized void keepOnly(Context context, Set<String> unread) throws JSONException {
        JSONObject chats = load(context, "chats");
        List<String> gone = new ArrayList<>();
        for (Iterator<String> it = chats.keys(); it.hasNext(); ) {
            String id = it.next();
            if (!unread.contains(id)) gone.add(id);
        }
        if (gone.isEmpty()) return;
        for (String id : gone) {
            chats.remove(id);
            cancel(context, numberOf(id));
        }
        save(context, "chats", chats);
        summary(context, chats);
    }

    /** Die Antwort steht sofort im Gespräch (sonst dreht Android weiter) — „wysyłanie…", bis der Läufer fertig ist. */
    static synchronized void replying(Context context, String chatId, String messageId, String text) throws JSONException {
        JSONObject chats = load(context, "chats");
        JSONObject state = chats.optJSONObject(chatId);
        if (state == null) {
            state = new JSONObject().put("title", "Rozmowa").put("open", "#/workspace/chat/" + chatId).put("lines", new JSONArray()).put("canReply", true);
            chats.put(chatId, state);
        }
        JSONArray lines = state.optJSONArray("lines");
        if (lines == null) {
            lines = new JSONArray();
            state.put("lines", lines);
        }
        lines.put(new JSONObject().put("id", messageId).put("author", "Ty").put("text", text + "  (wysyłanie…)")
                .put("ms", System.currentTimeMillis()).put("mine", true));
        state.put("dismissed", false);
        save(context, "chats", chats);
        postChat(context, chatId, state, false);
    }

    /** Wie die Antwort ausging: gesendet — oder mit dem Grund, und das Antwortfeld bleibt. */
    static synchronized void replied(Context context, String chatId, String messageId, String text, boolean ok, String error) throws JSONException {
        JSONObject chats = load(context, "chats");
        JSONObject state = chats.optJSONObject(chatId);
        if (state == null) return;
        JSONArray lines = state.optJSONArray("lines");
        if (lines != null) {
            for (int i = 0; i < lines.length(); i++) {
                JSONObject line = lines.getJSONObject(i);
                if (!messageId.equals(line.optString("id"))) continue;
                line.put("text", ok ? text : "Nie wysłano: " + text + (error == null || error.isEmpty() ? "" : " — " + error));
            }
        }
        if (ok) state.put("unread", 0);
        save(context, "chats", chats);
        postChat(context, chatId, state, !ok);
    }

    /** Beim Abmelden: nichts mehr zeigen, nichts mehr wissen. */
    static synchronized void clearAll(Context context) {
        try {
            for (String key : new String[] { "chats" }) {
                JSONObject stored = load(context, key);
                for (Iterator<String> it = stored.keys(); it.hasNext(); ) cancel(context, numberOf(it.next()));
            }
            JSONObject forms = load(context, "forms");
            for (Iterator<String> it = forms.keys(); it.hasNext(); ) cancel(context, numberOf("form:" + it.next()));
        } catch (Exception ignored) {
            // Was nicht lesbar ist, ist auch nicht zu sehen.
        }
        cancel(context, numberOf("links"));
        cancel(context, numberOf("chats-summary"));
        cancel(context, COUNTS_ID);
        prefs(context).edit().clear().apply();
    }
}
