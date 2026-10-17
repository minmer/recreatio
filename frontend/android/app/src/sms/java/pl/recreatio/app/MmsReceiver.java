package pl.recreatio.app;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.telephony.SubscriptionInfo;
import android.telephony.SubscriptionManager;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * EINE MMS KÜNDIGT SICH AN (WAP-Push, nur an die SMS-App des Telefons).
 *
 * <code>
 *   1  die Ankündigung (m-notification-ind) steht sofort im Gespräch:
 *      „MMS — wird geladen"
 *   2  das Telefon lädt sie (SmsManager.downloadMultimediaMessage)
 *   3  geladen ({@link #downloaded}): die MMS mit ihren Teilen in den Speicher,
 *      die Ankündigung fort, dem Netz „geladen" melden, Meldung, Archiv
 * </code>
 *
 * <p>Geht das Laden schief, bleibt die Ankündigung stehen; die Ansicht bietet
 * „Pobierz ponownie" an ({@link #retry}).</p>
 */
public class MmsReceiver extends BroadcastReceiver {

    private static final String TAG = "recreatio";
    private static final String PREFS = "recreatio.mms.pending";

    @Override
    public void onReceive(Context context, Intent intent) {
        byte[] data = intent.getByteArrayExtra("data");
        if (data == null) return;
        int subId = intent.getIntExtra("android.telephony.extra.SUBSCRIPTION_INDEX", intent.getIntExtra("subscription", -1));
        Context app = context.getApplicationContext();
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                handle(app, data, subId);
            } catch (RuntimeException e) {
                Log.w(TAG, "wap push failed", e);
            } finally {
                pending.finish();
            }
        }).start();
    }

    private static void handle(Context context, byte[] data, int subId) {
        MmsPdu.Message m;
        try {
            m = MmsPdu.parse(data);
        } catch (RuntimeException e) {
            Log.w(TAG, "unreadable mms push", e);
            return;
        }
        if (m.type != MmsPdu.NOTIFICATION_IND || m.contentLocation == null) return;

        /* Netzbetreiber schicken eine Ankündigung manchmal zweimal: dieselbe Transaktion nur einmal. */
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String key = m.transactionId != null ? m.transactionId : m.contentLocation;
        if (prefs.contains("done:" + key) || prefs.contains("row:" + key)) return;

        Uri row = SmsStore.insertMmsNotice(context, m, subId);
        if (row == null) return;
        prefs.edit()
                .putString("row:" + key, row.toString())
                .putString("loc:" + key, m.contentLocation)
                .putString("tid:" + key, m.transactionId == null ? "" : m.transactionId)
                .putInt("sub:" + key, subId)
                .apply();
        PhonePlugin.changed(SmsStore.threadOf(context, row));
        download(context, key);
    }

    /** Laden (oder noch einmal). */
    static void download(Context context, String key) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String location = prefs.getString("loc:" + key, null);
        if (location == null) return;
        int subId = prefs.getInt("sub:" + key, -1);
        File file = SmsSender.pduFile(context, "get-" + Integer.toHexString(Notices.numberOf(key)));
        //noinspection ResultOfMethodCallIgnored
        file.delete();
        try {
            //noinspection ResultOfMethodCallIgnored
            file.createNewFile();
        } catch (IOException e) {
            Log.w(TAG, "mms file", e);
            return;
        }
        Uri content = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        SmsSender.grant(context, content, Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent intent = new Intent(SmsSender.ACTION_MMS_DOWNLOADED, Uri.parse("recreatio-mms:" + Uri.encode(key)), context, SmsSender.Result.class)
                .putExtra("key", key)
                .putExtra("file", file.getAbsolutePath());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
        PendingIntent done = PendingIntent.getBroadcast(context, Notices.numberOf("get:" + key), intent, flags);
        try {
            SmsSender.manager(context, subId).downloadMultimediaMessage(context, location, content, null, done);
        } catch (RuntimeException e) {
            Log.w(TAG, "mms download failed to start", e);
        }
    }

    /** „Pobierz ponownie" an einer Ankündigung im Gespräch (`mms:<id>`). */
    static boolean retry(Context context, String id) {
        if (!id.startsWith("mms:")) return false;
        String row = "content://mms/" + id.substring(4);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        for (String name : prefs.getAll().keySet()) {
            if (!name.startsWith("row:")) continue;
            String stored = prefs.getString(name, "");
            if (stored.equals(row) || stored.endsWith("/" + id.substring(4))) {
                download(context, name.substring(4));
                return true;
            }
        }
        return false;
    }

    /** Das Telefon hat geladen (oder nicht). */
    static void downloaded(Context context, Intent intent, boolean ok) {
        String key = intent.getStringExtra("key");
        String path = intent.getStringExtra("file");
        if (key == null || path == null) return;
        File file = new File(path);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String rowText = prefs.getString("row:" + key, null);
        int subId = prefs.getInt("sub:" + key, -1);
        Uri notice = rowText == null ? null : Uri.parse(rowText);

        byte[] pdu = null;
        if (ok) {
            try (FileInputStream in = new FileInputStream(file)) {
                pdu = SmsStore.readAll(in, 64 * 1024 * 1024);
            } catch (IOException e) {
                Log.w(TAG, "mms read", e);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        file.delete();

        MmsPdu.Message m = null;
        if (pdu != null && pdu.length > 0) {
            try {
                m = MmsPdu.parse(pdu);
            } catch (RuntimeException e) {
                Log.w(TAG, "unreadable mms", e);
            }
        }
        if (m == null || m.type != MmsPdu.RETRIEVE_CONF) {
            /* Die Ankündigung bleibt stehen — die Ansicht bietet „Pobierz ponownie" an. */
            long thread = notice == null ? -1 : SmsStore.threadOf(context, notice);
            SmsNotices.mmsFailed(context, thread);
            PhonePlugin.changed(thread);
            return;
        }

        /* Wer im Gespräch ist: der Absender und die anderen Empfänger — ohne die eigenen Nummern. */
        Set<String> mine = ownNumbers(context);
        Set<String> people = new HashSet<>();
        if (m.from != null) people.add(m.from);
        for (String to : m.to) if (!same(to, mine)) people.add(to);
        for (String cc : m.cc) if (!same(cc, mine)) people.add(cc);
        if (m.date == 0) m.date = System.currentTimeMillis() / 1000L;

        Uri row = SmsStore.insertMms(context, m, 1, subId, people, false);
        if (row != null && notice != null) {
            try {
                context.getContentResolver().delete(notice, null, null);
            } catch (RuntimeException ignored) {
                // Dann steht die Ankündigung daneben.
            }
        }
        prefs.edit()
                .remove("row:" + key).remove("loc:" + key).remove("sub:" + key)
                .putLong("done:" + key, System.currentTimeMillis())
                .apply();
        acknowledge(context, prefs.getString("tid:" + key, m.transactionId), subId);
        prefs.edit().remove("tid:" + key).apply();

        long thread = row == null ? -1 : SmsStore.threadOf(context, row);
        SmsNotices.incoming(context, thread);
        PhonePlugin.changed(thread);
        PhoneWork.archiveSoon(context);
        tidy(prefs);
    }

    /** Dem Netz sagen: geladen. Ohne das schicken manche die Ankündigung immer wieder. */
    private static void acknowledge(Context context, String transactionId, int subId) {
        if (transactionId == null || transactionId.isEmpty()) return;
        try {
            byte[] pdu = MmsPdu.notifyResp(transactionId, MmsPdu.STATUS_RETRIEVED);
            File file = SmsSender.pduFile(context, "ack-" + Integer.toHexString(Notices.numberOf(transactionId)));
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(pdu);
            }
            Uri content = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            SmsSender.grant(context, content, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            SmsSender.manager(context, subId).sendMultimediaMessage(context, content, null, null, null);
        } catch (IOException | RuntimeException e) {
            Log.w(TAG, "mms acknowledge failed", e);
        }
    }

    /** Alte „schon geladen"-Vermerke weg (nach einer Woche wiederholt kein Netz mehr eine Ankündigung). */
    private static void tidy(SharedPreferences prefs) {
        long week = System.currentTimeMillis() - 7L * 24 * 3600_000L;
        SharedPreferences.Editor edit = prefs.edit();
        for (String name : prefs.getAll().keySet()) {
            if (name.startsWith("done:") && prefs.getLong(name, 0) < week) edit.remove(name);
        }
        edit.apply();
        /* Die Dateien der Bestätigungen, die liegen blieben. */
    }

    /** Die eigenen Nummern (soweit das Telefon sie kennt) — damit man in der Gruppe nicht mit sich selbst schreibt. */
    static Set<String> ownNumbers(Context context) {
        Set<String> out = new HashSet<>();
        try {
            SubscriptionManager subs = context.getSystemService(SubscriptionManager.class);
            List<SubscriptionInfo> list = subs == null ? null : subs.getActiveSubscriptionInfoList();
            if (list != null) for (SubscriptionInfo info : list) {
                String n = Build.VERSION.SDK_INT >= 33 ? subs.getPhoneNumber(info.getSubscriptionId()) : info.getNumber();
                if (n != null && !n.isEmpty()) out.add(n);
            }
        } catch (RuntimeException ignored) {
            // Ohne Erlaubnis (SecurityException): keine.
        }
        return out;
    }

    /** Dieselbe Nummer? Die letzten neun Ziffern entscheiden (Vorwahl mit oder ohne). */
    static boolean same(String number, Set<String> mine) {
        String a = tail(number);
        if (a.isEmpty()) return false;
        for (String m : mine) if (a.equals(tail(m))) return true;
        return false;
    }

    private static String tail(String number) {
        if (number == null) return "";
        StringBuilder digits = new StringBuilder();
        for (char c : number.toCharArray()) if (Character.isDigit(c)) digits.append(c);
        return digits.length() <= 9 ? digits.toString() : digits.substring(digits.length() - 9);
    }
}
