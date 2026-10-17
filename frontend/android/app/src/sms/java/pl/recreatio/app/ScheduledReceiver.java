package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * DER WECKER DER GEPLANTEN SMS ({@link ScheduledSms}) — zur Zeit senden; nach einem
 * Neustart (oder einer neuen Fassung der App) den Wecker wieder stellen.
 */
public class ScheduledReceiver extends BroadcastReceiver {

    private static final String TAG = "recreatio";

    @Override
    public void onReceive(Context context, Intent intent) {
        Context app = context.getApplicationContext();
        String action = intent.getAction();
        if (!ScheduledSms.ACTION.equals(action)) {
            /* BOOT_COMPLETED, MY_PACKAGE_REPLACED: Wecker gehen dabei verloren. */
            ScheduledSms.arm(app);
            return;
        }
        PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                for (long thread : ScheduledSms.sendDue(app)) PhonePlugin.changed(thread);
                /* Was aus dem Browser kam: dem Dienst melden, sobald das Netz geantwortet hat. */
                if (ScheduledSms.reportPending(app)) PhoneWork.outboxLater(app);
            } catch (Exception e) {
                Log.w(TAG, "scheduled sms", e);
            } finally {
                pending.finish();
            }
        }).start();
    }
}
