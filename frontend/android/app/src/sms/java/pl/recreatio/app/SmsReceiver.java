package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * EINE SMS KOMMT AN — und nur hier, solange diese App die SMS-App des Telefons
 * ist (SMS_DELIVER bekommt nur sie).
 *
 * <p>Damit ist sie dafür verantwortlich, dass die Nachricht nicht verloren geht:
 * sie steht sofort im Speicher des Telefons (dort fände sie auch Google
 * Messages), dann kommt die Meldung, dann — später, im Hintergrund — das
 * Archiv. Eine lange SMS reicht das Telefon in einem Stück herein.</p>
 */
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "recreatio";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_DELIVER_ACTION.equals(intent.getAction())) return;
        SmsMessage[] parts;
        try {
            parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        } catch (RuntimeException e) {
            Log.w(TAG, "unreadable sms", e);
            return;
        }
        if (parts == null || parts.length == 0) return;

        StringBuilder body = new StringBuilder();
        String address = null;
        long sentAt = 0;
        for (SmsMessage part : parts) {
            if (part == null) continue;
            if (address == null) address = part.getDisplayOriginatingAddress();
            if (sentAt == 0) sentAt = part.getTimestampMillis();
            String text = part.getDisplayMessageBody();
            if (text != null) body.append(text);
        }
        if (address == null) return;
        int subId = intent.getIntExtra("android.telephony.extra.SUBSCRIPTION_INDEX", intent.getIntExtra("subscription", -1));

        Context app = context.getApplicationContext();
        Uri row;
        try {
            row = SmsStore.insertInbox(app, address, body.toString(), sentAt, subId);
        } catch (RuntimeException e) {
            Log.w(TAG, "sms store failed", e);
            return;
        }
        long thread = SmsStore.threadOf(app, row);
        SmsNotices.incoming(app, thread);
        PhonePlugin.changed(thread);
        PhoneWork.archiveSoon(app);
    }
}
