package pl.recreatio.app;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.telephony.TelephonyManager;
import android.util.Log;

import java.util.List;

/**
 * „ODPISZ SMS-EM" beim Anruf, den man nicht annimmt (die schnellen Antworten
 * der Telefon-App) — das Telefon schickt den Text an die SMS-App des Telefons,
 * ohne Bildschirm. Jede SMS-App muss das können.
 */
public class RespondService extends Service {

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && TelephonyManager.ACTION_RESPOND_VIA_MESSAGE.equals(intent.getAction())) {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            List<String> to = ComposeActivity.recipients(intent.getData());
            if (text != null && !text.trim().isEmpty() && !to.isEmpty()) {
                new Thread(() -> {
                    try {
                        for (String one : to) SmsSender.sendSms(getApplicationContext(), one, text.trim(), -1);
                    } catch (RuntimeException e) {
                        Log.w("recreatio", "respond via message failed", e);
                    } finally {
                        stopSelf(startId);
                    }
                }).start();
                return START_NOT_STICKY;
            }
        }
        stopSelf(startId);
        return START_NOT_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
