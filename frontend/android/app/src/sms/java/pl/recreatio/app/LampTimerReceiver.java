package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * DER WECKER DER TIMER ({@link LampTimers}) — zur Zeit senden; nach einem Neustart,
 * einer neuen Fassung der App oder einer anderen Uhrzeit/Zeitzone den Wecker neu stellen.
 *
 * <p>Gesendet wird auf dem Faden des Senders ({@link LampRadio#RADIO}): ein Druck in der
 * offenen App und ein Timer überlagern sich nie.</p>
 *
 * <p><b>Wach bleiben, ohne zu hängen.</b> Mit Pausen zwischen vielen Aktionen dauert ein
 * Lauf länger, als Android einem Empfänger zugesteht ({@code goAsync}: Sekunden). Deshalb
 * hält ein eigener Wecklock das Telefon wach, bis der Lauf fertig ist (höchstens zehn
 * Minuten), und der Empfänger meldet sich nach {@link #RECEIVER_MS} ab — auch wenn der
 * Lauf noch weitergeht.</p>
 */
public class LampTimerReceiver extends BroadcastReceiver {

    private static final String TAG = "recreatio";
    private static final long RECEIVER_MS = 8_000;
    private static final long AWAKE_MAX_MS = 10 * 60_000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        Context app = context.getApplicationContext();
        if (!LampTimers.ACTION.equals(intent.getAction())) {
            LampTimers.arm(app);
            return;
        }
        long at = intent.getLongExtra("at", 0);
        PendingResult pending = goAsync();
        AtomicBoolean answered = new AtomicBoolean(false);
        Runnable done = () -> {
            if (answered.compareAndSet(false, true)) pending.finish();
        };
        new Handler(Looper.getMainLooper()).postDelayed(done, RECEIVER_MS);

        PowerManager power = (PowerManager) app.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock awake = power == null ? null : power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "recreatio:lamp-timer");
        if (awake != null) awake.acquire(AWAKE_MAX_MS);
        LampRadio.RADIO.execute(() -> {
            try {
                LampTimers.fire(app, at);
            } catch (Exception e) {
                Log.w(TAG, "lamp timer", e);
                LampTimers.arm(app);
            } finally {
                if (awake != null && awake.isHeld()) awake.release();
                done.run();
            }
        });
    }
}
