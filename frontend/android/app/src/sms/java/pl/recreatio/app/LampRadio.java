package pl.recreatio.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.AdvertisingSet;
import android.bluetooth.le.AdvertisingSetCallback;
import android.bluetooth.le.AdvertisingSetParameters;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.SystemClock;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * DAS SENDEN SELBST (2026-10-18) — für die Seite ({@link LampPlugin}) und für die
 * Timer ({@link LampTimers}, auch bei geschlossener App): eine echte BLE-Werbung über
 * {@link BluetoothLeAdvertiser}.
 *
 * <p>Legacy, nicht verbindbar (dann setzt Android keine Flags davor, und die 31 Bytes
 * bleiben ganz für das Paket), ohne Namen und ohne Sendeleistung im Paket. Je Ramka:
 * starten, auf den Rückruf warten (höchstens {@link #CALLBACK_MS}), halten, stoppen, die
 * Pause abwarten.</p>
 *
 * <p><b>Der Abstand der Pakete</b> (2026-10-21): solange eine Ramka gesendet wird,
 * wiederholt Android ihr Paket — so oft, wie das Intervall sagt. Ab Android 8 wird es
 * genau gesetzt ({@link AdvertisingSetParameters#setInterval}: 100 ms ist das Schnellste,
 * mehr verlangsamt — die Pause der Regler steht so auch zwischen den einzelnen Paketen).
 * Dieselben Einstellungen wie {@code startAdvertising} mit LOW_LATENCY (Legacy,
 * scannbar, nicht verbindbar, hohe Leistung), nur mit eigenem Intervall. Davor (Android
 * 7) gibt es nur drei Stufen: 100 ms, 250 ms, 1 s.</p>
 *
 * <p><b>Nacheinander.</b> Alles Senden läuft auf EINEM Faden ({@link #RADIO}) — ein Druck
 * auf der Seite und ein Timer überlagern sich nie. Wann abgebrochen wird, sagt der Auftrag
 * ({@link Cancel}): die Seite bei „Stop" und beim Verlassen der App, ein Timer nie.</p>
 */
final class LampRadio {

    /** Ein Faden für alles Senden — so überlagern sich nie zwei Werbungen. */
    static final ExecutorService RADIO = Executors.newSingleThreadExecutor();
    /** So lange darf Android mit „gestartet" oder „ging nicht" brauchen. */
    static final long CALLBACK_MS = 3000;

    /** Android 7: die Stufe, die dem Abstand am nächsten liegt (100 ms, 250 ms, 1 s). */
    private static AdvertiseSettings settingsOf(LampFrame frame) {
        int mode = frame.intervalMs <= 175 ? AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
            : frame.intervalMs <= 625 ? AdvertiseSettings.ADVERTISE_MODE_BALANCED
            : AdvertiseSettings.ADVERTISE_MODE_LOW_POWER;
        return new AdvertiseSettings.Builder()
            .setAdvertiseMode(mode)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(false)
            .setTimeout(0)
            .build();
    }

    /** Ab Android 8: wie {@code startAdvertising} es täte (Legacy, scannbar, nicht verbindbar, hohe Leistung) — mit genauem Intervall. */
    private static AdvertisingSetParameters parametersOf(LampFrame frame) {
        return new AdvertisingSetParameters.Builder()
            .setLegacyMode(true)
            .setConnectable(false)
            .setScannable(true)
            .setInterval(frame.intervalUnits())
            .setTxPowerLevel(AdvertisingSetParameters.TX_POWER_HIGH)
            .build();
    }

    /**
     * Eine Ramka starten. Der Rückruf (auf dem Hauptfaden) setzt {@code status}: 0 läuft,
     * sonst der Fehler — für beide Wege dieselben Zahlen. Zurück kommt, wie man sie stoppt.
     */
    @SuppressLint("MissingPermission")
    private static Runnable start(BluetoothLeAdvertiser advertiser, LampFrame frame, AdvertiseData data, AtomicInteger status, CountDownLatch answered) {
        if (Build.VERSION.SDK_INT >= 26) {
            AdvertisingSetCallback callback = new AdvertisingSetCallback() {
                @Override
                public void onAdvertisingSetStarted(AdvertisingSet set, int txPower, int result) {
                    status.set(result);
                    answered.countDown();
                }
            };
            advertiser.startAdvertisingSet(parametersOf(frame), data, null, null, null, callback);
            return () -> advertiser.stopAdvertisingSet(callback);
        }
        AdvertiseCallback callback = new AdvertiseCallback() {
            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                status.set(0);
                answered.countDown();
            }

            @Override
            public void onStartFailure(int errorCode) {
                status.set(errorCode);
                answered.countDown();
            }
        };
        advertiser.startAdvertising(settingsOf(frame), data, callback);
        return () -> advertiser.stopAdvertising(callback);
    }

    /** Wann ein Auftrag endet, bevor er fertig ist. */
    interface Cancel {
        /** Warten — {@code false}, wenn vorher abgesagt wurde. */
        boolean hold(long ms);

        boolean cancelled();

        /** Das Wort für die Seite: {@code stopped}, {@code paused}. */
        String reason();
    }

    /** Für die Timer: nie abgesagt, nur gewartet. */
    static final Cancel NEVER = new Cancel() {
        @Override
        public boolean hold(long ms) {
            try {
                Thread.sleep(ms);
                return true;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return false;
            }
        }

        @Override
        public boolean cancelled() {
            return false;
        }

        @Override
        public String reason() {
            return "stopped";
        }
    };

    private LampRadio() {
    }

    static BluetoothAdapter adapter(Context context) {
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    /** Bis Android 11 gibt es BLUETOOTH_ADVERTISE nicht — dort reicht, was bei der Installation erteilt wurde. */
    static boolean permitted(Context context) {
        return Build.VERSION.SDK_INT < 31
            || ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED;
    }

    static Object orNull(String text) {
        return text == null ? JSONObject.NULL : text;
    }

    /** Die Ramki aus dem, was die Seite schickt (oder was ein Timer gespeichert hat). */
    static List<LampFrame> framesOf(JSONArray list) throws Exception {
        if (list == null || list.length() == 0) throw new IllegalArgumentException("Brak ramek do nadania.");
        if (list.length() > LampFrame.MAX_FRAMES) throw new IllegalArgumentException("Najwyżej " + LampFrame.MAX_FRAMES + " ramek.");
        List<LampFrame> out = new ArrayList<>();
        for (int i = 0; i < list.length(); i++) {
            JSONObject one = list.getJSONObject(i);
            out.add(LampFrame.of(one.getInt("manufacturerId"), one.getString("data"), one.optLong("durationMs", 1000), one.optLong("gapMs", 0),
                one.optLong("intervalMs", LampFrame.MIN_INTERVAL_MS)));
        }
        return out;
    }

    static String advertiseCode(int error) {
        switch (error) {
            case AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE: return "data-too-large";
            case AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS: return "too-many-advertisers";
            case AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED: return "already-started";
            case AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED: return "feature-unsupported";
            default: return "internal-error";
        }
    }

    static JSObject outcome(String code, String detail, long startedAt, JSArray frames) {
        JSObject out = new JSObject();
        out.put("code", code);
        out.put("detail", orNull(detail));
        out.put("startedAt", startedAt);
        out.put("endedAt", System.currentTimeMillis());
        out.put("frames", frames);
        return out;
    }

    private static void stopQuietly(Runnable stop) {
        try {
            stop.run();
        } catch (RuntimeException ignored) {
            // Bluetooth inzwischen aus: dann wirbt auch nichts mehr.
        }
    }

    /** Auf {@link #RADIO}: die Ramki nacheinander. */
    @SuppressLint("MissingPermission")
    static JSObject transmit(Context context, List<LampFrame> frames, Cancel cancel) {
        long began = System.currentTimeMillis();
        JSArray done = new JSArray();
        if (cancel.cancelled()) return outcome(cancel.reason(), null, began, done);

        BluetoothAdapter adapter = adapter(context);
        if (adapter == null) return outcome("no-bluetooth", null, began, done);
        if (!adapter.isEnabled()) return outcome("bluetooth-off", null, began, done);
        if (!permitted(context)) return outcome("no-permission", null, began, done);
        BluetoothLeAdvertiser advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) return outcome("no-advertiser", null, began, done);

        for (int i = 0; i < frames.size(); i++) {
            LampFrame frame = frames.get(i);
            JSObject one = new JSObject();
            one.put("index", i);
            one.put("requestedMs", frame.durationMs);
            one.put("intervalMs", frame.intervalMs);
            done.put(one);

            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addManufacturerData(frame.manufacturerId, frame.data)
                .build();

            CountDownLatch answered = new CountDownLatch(1);
            AtomicInteger failure = new AtomicInteger(Integer.MIN_VALUE);
            Runnable stop;

            long asked = SystemClock.elapsedRealtime();
            try {
                stop = start(advertiser, frame, data, failure, answered);
            } catch (SecurityException e) {
                one.put("code", "no-permission");
                return outcome("no-permission", e.getMessage(), began, done);
            } catch (IllegalStateException e) {
                /* „BT Adapter is not turned ON" — zwischen der Prüfung und dem Start ausgeschaltet. */
                one.put("code", "bluetooth-off");
                return outcome("bluetooth-off", e.getMessage(), began, done);
            } catch (IllegalArgumentException e) {
                /* startAdvertisingSet prüft selbst: „Legacy advertising data too big". */
                one.put("code", "data-too-large");
                return outcome("data-too-large", e.getMessage(), began, done);
            } catch (RuntimeException e) {
                one.put("code", "error");
                return outcome("error", e.getClass().getSimpleName() + ": " + e.getMessage(), began, done);
            }

            boolean heardBack;
            try {
                heardBack = answered.await(CALLBACK_MS, TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                heardBack = false;
            }
            long startedAt = SystemClock.elapsedRealtime();
            one.put("startMs", startedAt - asked);
            if (!heardBack) {
                stopQuietly(stop);
                one.put("code", "no-callback");
                return outcome("no-callback", "Brak AdvertiseCallback po " + CALLBACK_MS + " ms.", began, done);
            }
            if (failure.get() != 0) {
                String code = advertiseCode(failure.get());
                one.put("code", code);
                return outcome(code, "AdvertiseCallback.onStartFailure(" + failure.get() + ")", began, done);
            }

            one.put("startedAt", System.currentTimeMillis());
            boolean full = cancel.hold(frame.durationMs);
            stopQuietly(stop);
            one.put("stoppedAt", System.currentTimeMillis());
            one.put("heldMs", SystemClock.elapsedRealtime() - startedAt);
            one.put("code", full ? "ok" : cancel.reason());
            if (!full) return outcome(cancel.reason(), null, began, done);

            if (i < frames.size() - 1 && frame.gapMs > 0 && !cancel.hold(frame.gapMs)) {
                return outcome(cancel.reason(), null, began, done);
            }
        }
        return outcome("ok", null, began, done);
    }
}
