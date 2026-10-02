package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * DER WECKER KLINGELT (0076) — und nach einem Neustart oder einer neuen
 * Fassung der App stellt er alle Erinnerungen wieder hin ({@link Reminders}).
 */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        Context app = context.getApplicationContext();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Reminders.restore(app);
            return;
        }
        String tag = intent.getStringExtra("tag");
        if (tag == null) return;
        try {
            Reminders.fire(app, tag);
        } catch (Exception e) {
            Log.w("recreatio", "reminder failed", e);
        }
    }
}
