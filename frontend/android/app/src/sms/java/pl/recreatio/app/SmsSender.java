package pl.recreatio.app;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.telephony.SmsManager;
import android.telephony.SubscriptionManager;
import android.util.Log;

import androidx.core.content.FileProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * HINAUS — eine SMS (in Stücken, wenn sie lang ist) oder eine MMS (ein Bild,
 * mehrere Empfänger als Gruppe).
 *
 * <p>Erst steht die Nachricht im Ausgang des Speichers (sie ist sofort im
 * Gespräch zu sehen), dann geht sie hinaus; das Ergebnis meldet das Telefon an
 * {@link Result} — dann wird sie „wysłana" oder „nie wysłano".</p>
 */
final class SmsSender {

    private static final String TAG = "recreatio";
    static final String ACTION_SMS_SENT = "pl.recreatio.app.SMS_SENT";
    static final String ACTION_MMS_SENT = "pl.recreatio.app.MMS_SENT";
    static final String ACTION_MMS_DOWNLOADED = "pl.recreatio.app.MMS_DOWNLOADED";
    private static final String PREFS = "recreatio.sms.sending";

    /** Wenn der Netzbetreiber nichts sagt: so gross darf eine MMS sein. */
    private static final int MMS_DEFAULT_MAX = 300 * 1024;

    private SmsSender() {
    }

    static SmsManager manager(Context context, int subId) {
        if (Build.VERSION.SDK_INT >= 31) {
            SmsManager base = context.getSystemService(SmsManager.class);
            return subId >= 0 ? base.createForSubscriptionId(subId) : base;
        }
        //noinspection deprecation
        return subId >= 0 ? SmsManager.getSmsManagerForSubscriptionId(subId) : SmsManager.getDefault();
    }

    static int defaultSubId() {
        try {
            return SubscriptionManager.getDefaultSmsSubscriptionId();
        } catch (RuntimeException e) {
            return -1;
        }
    }

    private static int flags() {
        /* Das Ergebnis kommt mit Angaben des Telefons (Fehlercode) — dafür muss die Absicht veränderlich sein. */
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE : 0);
    }

    /* -- SMS ------------------------------------------------------------------------------------ */

    /** Eine SMS an eine Nummer. Gibt das Gespräch zurück. */
    static long sendSms(Context context, String address, String body, int subId) {
        int sub = subId >= 0 ? subId : defaultSubId();
        SmsManager sms = manager(context, sub);
        ArrayList<String> pieces = sms.divideMessage(body);
        long thread = SmsStore.threadFor(context, Collections.singleton(address));
        Uri row = SmsStore.insertOutbox(context, address, body, sub, thread);
        if (row == null) throw new IllegalStateException("Nie udało się zapisać wiadomości.");

        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt(row + "#parts", pieces.size()).putInt(row + "#ok", 0).putBoolean(row + "#failed", false).apply();

        ArrayList<PendingIntent> sent = new ArrayList<>();
        for (int i = 0; i < pieces.size(); i++) {
            Intent intent = new Intent(ACTION_SMS_SENT, row, context, Result.class).putExtra("part", i);
            sent.add(PendingIntent.getBroadcast(context, Notices.numberOf(row + "#" + i), intent, flags()));
        }
        try {
            if (pieces.size() == 1) sms.sendTextMessage(address, null, body, sent.get(0), null);
            else sms.sendMultipartTextMessage(address, null, pieces, sent, null);
        } catch (RuntimeException e) {
            Log.w(TAG, "sms send failed", e);
            SmsStore.smsResult(context, row, false, -1);
            forget(context, row);
            throw e;
        }
        return thread;
    }

    private static void forget(Context context, Uri row) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .remove(row + "#parts").remove(row + "#ok").remove(row + "#failed").apply();
    }

    /* -- MMS ------------------------------------------------------------------------------------ */

    /** Eine MMS an alle {@code to} (eine Gruppe): Text und höchstens ein Bild. Gibt das Gespräch zurück. */
    static long sendMms(Context context, List<String> to, String body, byte[] media, String mediaType, String mediaName, int subId) throws IOException {
        int sub = subId >= 0 ? subId : defaultSubId();
        SmsManager mms = manager(context, sub);
        int max = MMS_DEFAULT_MAX;
        try {
            Bundle config = mms.getCarrierConfigValues();
            if (config != null) max = config.getInt(SmsManager.MMS_CONFIG_MAX_MESSAGE_SIZE, MMS_DEFAULT_MAX);
        } catch (RuntimeException ignored) {
            // die Vorgabe
        }

        List<MmsPdu.OutPart> out = new ArrayList<>();
        String imageLocation = null;
        String textLocation = null;
        byte[] attached = null;
        String attachedType = null;
        if (media != null && media.length > 0) {
            attachedType = mediaType == null ? "application/octet-stream" : mediaType;
            attached = attachedType.startsWith("image/") ? fit(media, max - 16 * 1024) : media;
            if (attachedType.startsWith("image/")) attachedType = "image/jpeg";
            if (attached.length > max) throw new IOException("Załącznik jest za duży na MMS (najwyżej " + (max / 1024) + " KB).");
            imageLocation = attachedType.equals("image/jpeg") ? "image_0.jpg" : (mediaName == null ? "part_0" : mediaName);
        }
        if (body != null && !body.trim().isEmpty()) textLocation = "text_0.txt";

        out.add(new MmsPdu.OutPart("application/smil", null, "<smil>", "smil.xml",
                MmsPdu.smil(imageLocation, attachedType, textLocation).getBytes(StandardCharsets.UTF_8), false));
        if (attached != null) out.add(new MmsPdu.OutPart(attachedType, imageLocation, "<image_0>", imageLocation, attached, false));
        if (textLocation != null) out.add(new MmsPdu.OutPart("text/plain", null, "<text_0>", textLocation, body.getBytes(StandardCharsets.UTF_8), true));

        String transaction = "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 20);
        long now = System.currentTimeMillis() / 1000L;
        byte[] pdu = MmsPdu.sendReq(to, null, out, transaction, now);

        /* Im Speicher: im Ausgang, mit denselben Teilen (für das Gespräch). */
        MmsPdu.Message stored = new MmsPdu.Message();
        stored.type = MmsPdu.SEND_REQ;
        stored.transactionId = transaction;
        stored.date = now;
        stored.contentType = "application/vnd.wap.multipart.related";
        stored.to.addAll(to);
        for (MmsPdu.OutPart p : out) {
            MmsPdu.Part part = new MmsPdu.Part();
            part.type = p.type;
            part.name = p.name;
            part.contentId = p.contentId;
            part.contentLocation = p.contentLocation;
            part.charset = p.text || p.type.equals("application/smil") ? 106 : 0;
            part.data = p.data;
            stored.parts.add(part);
        }
        Set<String> people = SmsStore.setOf(to);
        Uri row = SmsStore.insertMms(context, stored, 4, sub, people, true);
        if (row == null) throw new IOException("Nie udało się zapisać MMS.");

        File file = pduFile(context, "send-" + row.getLastPathSegment());
        try (FileOutputStream write = new FileOutputStream(file)) {
            write.write(pdu);
        }
        Uri content = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        grant(context, content, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent intent = new Intent(ACTION_MMS_SENT, row, context, Result.class).putExtra("file", file.getAbsolutePath());
        PendingIntent sent = PendingIntent.getBroadcast(context, Notices.numberOf("mms:" + row), intent, flags());
        try {
            mms.sendMultimediaMessage(context, content, null, null, sent);
        } catch (RuntimeException e) {
            SmsStore.mmsResult(context, row, false, null);
            //noinspection ResultOfMethodCallIgnored
            file.delete();
            throw e;
        }
        return SmsStore.threadOf(context, row);
    }

    static File pduFile(Context context, String name) {
        File folder = new File(context.getCacheDir(), "mms");
        //noinspection ResultOfMethodCallIgnored
        folder.mkdirs();
        return new File(folder, name + ".pdu");
    }

    /** Der Dienst des Telefons, der MMS sendet und lädt, liest und schreibt die Datei über diese Adresse. */
    static void grant(Context context, Uri content, int mode) {
        for (String pkg : new String[] { "com.android.phone", "com.android.mms.service" }) {
            try {
                context.grantUriPermission(pkg, content, mode);
            } catch (RuntimeException ignored) {
                // Diesen Dienst gibt es auf diesem Telefon nicht.
            }
        }
    }

    /** Ein Bild so verkleinern, dass es in eine MMS passt (JPEG). */
    static byte[] fit(byte[] image, int max) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(image, 0, image.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("To nie jest obraz.");
        int longest = Math.max(bounds.outWidth, bounds.outHeight);
        for (int edge : new int[] { 1600, 1280, 1024, 800, 640, 480, 320 }) {
            BitmapFactory.Options load = new BitmapFactory.Options();
            load.inSampleSize = 1;
            while (longest / (load.inSampleSize * 2) >= edge) load.inSampleSize *= 2;
            Bitmap bitmap = BitmapFactory.decodeByteArray(image, 0, image.length, load);
            if (bitmap == null) throw new IOException("To nie jest obraz.");
            int w = bitmap.getWidth();
            int h = bitmap.getHeight();
            float scale = Math.min(1f, (float) edge / Math.max(w, h));
            Bitmap sized = scale < 1f ? Bitmap.createScaledBitmap(bitmap, Math.round(w * scale), Math.round(h * scale), true) : bitmap;
            for (int quality : new int[] { 85, 70, 55 }) {
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                sized.compress(Bitmap.CompressFormat.JPEG, quality, out);
                if (out.size() <= max) return out.toByteArray();
            }
        }
        throw new IOException("Obraz nie mieści się w MMS.");
    }

    /* -- Was das Telefon zurückmeldet ------------------------------------------------------------- */

    /** Gesendet (jedes Stück einer SMS), MMS gesendet, MMS geladen. */
    public static final class Result extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            Uri row = intent.getData();
            if (action == null) return;
            Context app = context.getApplicationContext();
            /* Erst das Ergebnis, dann goAsync — danach gibt der Empfänger es nicht mehr heraus. */
            final int code = getResultCode();
            PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    switch (action) {
                        case ACTION_SMS_SENT: smsSent(app, row, code == Activity.RESULT_OK, intent.getIntExtra("errorCode", code)); break;
                        case ACTION_MMS_SENT: mmsSent(app, row, code == Activity.RESULT_OK, intent); break;
                        case ACTION_MMS_DOWNLOADED: MmsReceiver.downloaded(app, intent, code == Activity.RESULT_OK); break;
                        default: break;
                    }
                } catch (RuntimeException e) {
                    Log.w(TAG, "sms result failed", e);
                } finally {
                    pending.finish();
                }
            }).start();
        }

        private static void smsSent(Context context, Uri row, boolean ok, int error) {
            if (row == null) return;
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            int parts = prefs.getInt(row + "#parts", 1);
            int done;
            boolean failed;
            synchronized (SmsSender.class) {
                done = prefs.getInt(row + "#ok", 0) + 1;
                failed = prefs.getBoolean(row + "#failed", false) || !ok;
                prefs.edit().putInt(row + "#ok", done).putBoolean(row + "#failed", failed).apply();
            }
            if (done < parts) return;
            SmsStore.smsResult(context, row, !failed, error);
            forget(context, row);
            long thread = SmsStore.threadOf(context, row);
            if (failed) SmsNotices.failed(context, thread);
            PhonePlugin.changed(thread);
            PhoneWork.archiveSoon(context);
        }

        private static void mmsSent(Context context, Uri row, boolean ok, Intent intent) {
            String path = intent.getStringExtra("file");
            if (path != null) {
                //noinspection ResultOfMethodCallIgnored
                new File(path).delete();
            }
            if (row == null) return;
            String messageId = null;
            byte[] conf = intent.getByteArrayExtra(SmsManager.EXTRA_MMS_DATA);
            if (ok && conf != null) {
                try {
                    MmsPdu.Message m = MmsPdu.parse(conf);
                    messageId = m.messageId;
                    if (m.responseStatus != 0 && m.responseStatus != 0x80) ok = false;
                } catch (RuntimeException ignored) {
                    // Ohne Bestätigung gilt das Ergebnis des Telefons.
                }
            }
            SmsStore.mmsResult(context, row, ok, messageId);
            long thread = SmsStore.threadOf(context, row);
            if (!ok) SmsNotices.failed(context, thread);
            PhonePlugin.changed(thread);
            PhoneWork.archiveSoon(context);
        }
    }
}
