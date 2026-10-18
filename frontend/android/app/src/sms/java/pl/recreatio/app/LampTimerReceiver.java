package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * DER WECKER DER TIMER ({@link LampTimers}) — zur Zeit senden; nach einem Neustart,
 * einer neuen Fassung der App oder einer anderen Uhrzeit/Zeitzone den Wecker neu stellen.
 *
 * <p>Gesendet wird auf dem Faden des Senders ({@link LampRadio#RADIO}): ein Druck in der
 * offenen App und ein Timer überlagern sich nie. Solange er läuft, hält Android das Telefon
 * wach ({@code goAsync} unter dem Wecker).</p>
 */
public class LampTimerReceiver extends BroadcastReceiver {

    private static final String TAG = "recreatio";

    @Override
    public void onReceive(Context context, Intent intent) {
        Context app = context.getApplicationContext();
        if (!LampTimers.ACTION.equals(intent.getAction())) {
            LampTimers.arm(app);
            return;
        }
        long at = intent.getLongExtra("at", 0);
        PendingResult pending = goAsync();
        LampRadio.RADIO.execute(() -> {
            try {
                LampTimers.fire(app, at);
            } catch (Exception e) {
                Log.w(TAG, "lamp timer", e);
                LampTimers.arm(app);
            } finally {
                pending.finish();
            }
        });
    }
}
