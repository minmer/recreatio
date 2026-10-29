package pl.recreatio.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.ContextCompat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * DIE MELDUNGEN DER SMS — je Gespräch eine (wie in jeder SMS-App): wer, was,
 * wann; „Odpowiedz" mit Antwortfeld und „Przeczytane". Ist das Gespräch gerade
 * in der App offen, meldet sich nichts.
 *
 * <p>Den Inhalt zeigt das Telefon so, wie es ihn hat — SMS liegen auf dem
 * Telefon ohnehin offen. Auf dem Sperrbildschirm steht nur „Nowa wiadomość",
 * wenn das Telefon vertrauliche Inhalte verbirgt.</p>
 */
final class SmsNotices {

    /**
     * 2026-10-29 — EIN EIGENER KLANG ({@code res/raw/sms_tone}, gerechnet von
     * {@code scripts/android-sounds.mjs}). Android behält den Klang eines Kanals für immer;
     * darum heisst der Kanal neu, und der alte („sms", mit dem Klang des Telefons) geht fort.
     * Wer in den Einstellungen des Telefons einen anderen Klang wählt, behält ihn.
     */
    static final String CHANNEL = "sms_tone";
    private static final String OLD_CHANNEL = "sms";
    private static final String TONE = "sms_tone";
    static final String ACTION_REPLY = "pl.recreatio.app.SMS_REPLY";
    static final String ACTION_READ = "pl.recreatio.app.SMS_READ";
    private static final String KEY_REPLY = "sms_reply";
    private static final String TAG = "recreatio";

    private SmsNotices() {
    }

    /** Der Klang nach Namen, nicht nach Nummer: die Nummer einer Ressource wechselt mit dem Bau, der Kanal behält die Adresse. */
    static Uri tone(Context context) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/raw/" + TONE);
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(OLD_CHANNEL) != null) manager.deleteNotificationChannel(OLD_CHANNEL);
        if (manager.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel sms = new NotificationChannel(CHANNEL, "SMS", NotificationManager.IMPORTANCE_HIGH);
        sms.setDescription("Przychodzące SMS i MMS — z własnym dźwiękiem, innym niż powiadomienia recreatio");
        sms.setSound(tone(context), new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        sms.enableVibration(true);
        manager.createNotificationChannel(sms);
    }

    /**
     * EINE MELDUNG DER SMS — die Sprechblase in Blau statt „RE" in Braun (die App, {@link Notices#builder}).
     * Vor Android 8 gibt es keine Kanäle: dort trägt die Meldung den Klang selbst.
     */
    static NotificationCompat.Builder builder(Context context) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_sms)
                .setColor(ContextCompat.getColor(context, R.color.notice_sms));
        if (Build.VERSION.SDK_INT < 26) builder.setSound(tone(context)).setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS);
        return builder;
    }

    static int idOf(long thread) {
        return Notices.numberOf("sms:" + thread);
    }

    private static final class Line {
        final String address;
        final String text;
        final long at;

        Line(String address, String text, long at) {
            this.address = address;
            this.text = text;
            this.at = at;
        }
    }

    /** Die ungelesenen eingehenden Nachrichten eines Gesprächs, die letzten acht, der Zeit nach. */
    private static List<Line> unread(Context context, long thread) {
        List<Line> out = new ArrayList<>();
        ContentResolver cr = context.getContentResolver();
        String[] args = { String.valueOf(thread) };
        try (Cursor c = cr.query(SmsStore.SMS, new String[] { "address", "body", "date" }, "thread_id = ? AND type = 1 AND read = 0", args, "date DESC")) {
            while (c != null && c.moveToNext() && out.size() < 8) out.add(new Line(c.getString(0), c.getString(1) == null ? "" : c.getString(1), c.getLong(2)));
        } catch (RuntimeException ignored) {
            // ohne SMS
        }
        try (Cursor c = cr.query(SmsStore.MMS, new String[] { "_id", "date", "m_type" }, "thread_id = ? AND msg_box = 1 AND read = 0", args, "date DESC")) {
            while (c != null && c.moveToNext() && out.size() < 12) {
                long id = c.getLong(0);
                String from = null;
                try (Cursor a = cr.query(Uri.parse("content://mms/" + id + "/addr"), new String[] { "address" }, "type = " + SmsStore.ADDR_FROM, null, null)) {
                    if (a != null && a.moveToFirst()) from = a.getString(0);
                }
                String text = c.getInt(2) == MmsPdu.NOTIFICATION_IND ? "MMS — pobieranie…" : mmsText(cr, id);
                out.add(new Line(from, text, c.getLong(1) * 1000L));
            }
        } catch (RuntimeException ignored) {
            // ohne MMS
        }
        Collections.sort(out, (a, b) -> Long.compare(a.at, b.at));
        while (out.size() > 8) out.remove(0);
        return out;
    }

    private static String mmsText(ContentResolver cr, long id) {
        StringBuilder text = new StringBuilder();
        boolean media = false;
        try (Cursor p = cr.query(SmsStore.MMS_PART, new String[] { "ct", "text" }, "mid = ?", new String[] { String.valueOf(id) }, "seq")) {
            while (p != null && p.moveToNext()) {
                String type = p.getString(0) == null ? "" : p.getString(0);
                if (type.equals("application/smil")) continue;
                if (type.startsWith("text/plain")) {
                    if (p.getString(1) != null) text.append(p.getString(1));
                } else {
                    media = true;
                }
            }
        } catch (RuntimeException ignored) {
            // nur „MMS"
        }
        String prefix = media ? "📷 " : "";
        return text.length() == 0 ? (media ? "📷 Zdjęcie" : "MMS") : prefix + text;
    }

    private static String title(Context context, long thread) {
        List<String> names = new ArrayList<>();
        for (String address : SmsStore.recipients(context, thread)) {
            String name = SmsStore.nameOf(context, address);
            names.add(name != null ? name : address);
        }
        return names.isEmpty() ? "SMS" : String.join(", ", names);
    }

    private static PendingIntent action(Context context, String action, long thread, boolean mutable) {
        Intent intent = new Intent(context, Actions.class).setAction(action).setData(Uri.parse("recreatio-sms:" + action + ":" + thread)).putExtra("thread", thread);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (mutable && Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
        if (!mutable) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, Notices.numberOf(action + ":" + thread), intent, flags);
    }

    /** Neues in einem Gespräch — die Meldung zeigt die ungelesenen Nachrichten; ist es offen, nichts. */
    static void incoming(Context context, long thread) {
        if (thread < 0) return;
        if (MainActivity.inFront && PhonePlugin.viewing() == thread) return;
        /* Wyciszone (2026-10-19): die Nachricht steht im Gespräch, gemeldet wird sie nicht. */
        if (Spam.muted(context, thread)) {
            Notices.cancel(context, idOf(thread));
            return;
        }
        List<Line> lines = unread(context, thread);
        if (lines.isEmpty()) {
            Notices.cancel(context, idOf(thread));
            return;
        }
        ensureChannel(context);
        List<String> recipients = SmsStore.recipients(context, thread);
        boolean group = recipients.size() > 1;
        Person me = new Person.Builder().setName("Ty").build();
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me);
        if (group) style.setConversationTitle(title(context, thread)).setGroupConversation(true);
        for (Line line : lines) {
            String sender = line.address == null ? title(context, thread) : SmsStore.nameOf(context, line.address);
            if (sender == null) sender = line.address;
            style.addMessage(line.text, line.at, new Person.Builder().setName(sender).setKey(line.address == null ? "?" : line.address).build());
        }

        RemoteInput input = new RemoteInput.Builder(KEY_REPLY).setLabel("Odpowiedz").build();
        NotificationCompat.Action reply = new NotificationCompat.Action.Builder(R.drawable.ic_stat_sms, "Odpowiedz", action(context, ACTION_REPLY, thread, true))
                .addRemoteInput(input)
                .setAllowGeneratedReplies(true)
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_REPLY)
                .setShowsUserInterface(false)
                .build();
        NotificationCompat.Action read = new NotificationCompat.Action.Builder(R.drawable.ic_stat_sms, "Przeczytane", action(context, ACTION_READ, thread, false))
                .setSemanticAction(NotificationCompat.Action.SEMANTIC_ACTION_MARK_AS_READ)
                .setShowsUserInterface(false)
                .build();

        NotificationCompat.Builder hidden = builder(context)
                .setContentTitle("Nowa wiadomość SMS");

        Notices.post(context, idOf(thread), builder(context)
                .setStyle(style)
                .setContentIntent(Notices.openIntent(context, "#/workspace/sms/" + thread, idOf(thread)))
                .setAutoCancel(true)
                .setWhen(lines.get(lines.size() - 1).at)
                .setShowWhen(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                .setPublicVersion(hidden.build())
                .addAction(reply)
                .addAction(read));
    }

    static void cancel(Context context, long thread) {
        Notices.cancel(context, idOf(thread));
    }

    private static void problem(Context context, long thread, String text) {
        ensureChannel(context);
        int id = Notices.numberOf("sms-problem:" + thread);
        Notices.post(context, id, builder(context)
                .setContentTitle(title(context, thread))
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(Notices.openIntent(context, thread < 0 ? "#/workspace/sms" : "#/workspace/sms/" + thread, id))
                .setCategory(NotificationCompat.CATEGORY_ERROR)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT));
    }

    static void failed(Context context, long thread) {
        problem(context, thread, "Nie wysłano wiadomości — otwórz, żeby spróbować ponownie.");
    }

    static void mmsFailed(Context context, long thread) {
        problem(context, thread, "Nie udało się pobrać MMS — otwórz, żeby spróbować ponownie.");
    }

    /** „Odpowiedz" und „Przeczytane" aus der Meldung. */
    public static final class Actions extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            long thread = intent.getLongExtra("thread", -1);
            if (action == null || thread < 0) return;
            Context app = context.getApplicationContext();
            String text = null;
            if (ACTION_REPLY.equals(action)) {
                Bundle input = RemoteInput.getResultsFromIntent(intent);
                CharSequence typed = input == null ? null : input.getCharSequence(KEY_REPLY);
                text = typed == null ? null : typed.toString().trim();
                if (text == null || text.isEmpty()) return;
            }
            final String reply = text;
            PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    if (reply != null) {
                        /* Über die Karte des Gesprächs (die Seite legt sie fest), sonst über die, auf der zuletzt etwas kam. */
                        int sub = Spam.threadSub(app, thread);
                        if (sub < 0) sub = SmsStore.lastIncomingSub(app, thread);
                        List<String> to = SmsStore.recipients(app, thread);
                        if (to.size() == 1) SmsSender.sendSms(app, to.get(0), reply, sub);
                        else if (to.size() > 1) SmsSender.sendMms(app, to, reply, null, null, null, sub);
                    }
                    SmsStore.markRead(app, thread);
                    cancel(app, thread);
                    PhonePlugin.changed(thread);
                } catch (Exception e) {
                    Log.w(TAG, "sms action failed", e);
                    failed(app, thread);
                } finally {
                    pending.finish();
                }
            }).start();
        }
    }
}
