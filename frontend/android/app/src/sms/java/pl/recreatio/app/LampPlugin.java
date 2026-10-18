package pl.recreatio.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanRecord;
import android.bluetooth.le.ScanResult;
import android.bluetooth.le.ScanSettings;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;

import androidx.core.location.LocationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

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
 * DER SENDER FÜR DIE LAMPEN (Ausgabe „sms", 2026-10-18) — `lamps/native.ts`.
 *
 * <code>
 *   support, requestPermission, send, stop, openSettings
 *   requestScanPermission, startScan, stopScan   (Ereignisse lampScan, lampScanEnd)
 * </code>
 *
 * <p><b>Senden</b> ist eine echte BLE-Werbung über {@link BluetoothLeAdvertiser}:
 * Legacy, nicht verbindbar (dann setzt Android keine Flags davor, und die 31 Bytes
 * bleiben ganz für das Paket), {@code ADVERTISE_MODE_LOW_LATENCY}, ohne Namen und
 * ohne Sendeleistung im Paket. Je Ramka: starten, auf den Rückruf warten (höchstens
 * {@link #CALLBACK_MS}), halten, stoppen, die Pause abwarten. Wie oft Android das
 * Paket in dieser Zeit wiederholt, bestimmt Android (bei LOW_LATENCY etwa alle 100 ms).</p>
 *
 * <p><b>Nacheinander.</b> Alle Aufträge laufen auf EINEM eigenen Faden ({@link #RADIO}):
 * ein zweiter Druck wartet, bis der erste gestoppt ist. „Stopp" und das Verlassen der
 * App erhöhen {@link #generation} — der laufende Auftrag stoppt sofort, wartende
 * enden, ohne zu senden.</p>
 *
 * <p><b>Was nicht geht.</b> Die Adresse, mit der gesendet wird, wählt Android (eine
 * zufällige des Telefons) — die des Pilots lässt sich nicht nachmachen. Und ein
 * gelungener Rückruf sagt nur, dass Android sendet, nicht, dass eine Lampe es tat.</p>
 *
 * <p><b>Hören</b> (vom Pilot lernen): ein Scan ohne Filter, LOW_LATENCY, jedes Paket
 * einzeln. Gebündelt alle {@link #FLUSH_MS} ms an die Seite ({@code lampScan}); das Ende
 * (Stopp, Zeit um, Fehler, App verlassen) als {@code lampScanEnd}. Alles am Scan läuft
 * auf dem Hauptfaden — dort kommen auch die Rückrufe an.</p>
 */
@CapacitorPlugin(
    name = "Lamp",
    permissions = {
        @Permission(alias = "advertise", strings = { Manifest.permission.BLUETOOTH_ADVERTISE }),
        @Permission(alias = "scan", strings = { Manifest.permission.BLUETOOTH_SCAN }),
        /* Bis Android 11 braucht ein Scan die genaue Lage (Manifest: maxSdkVersion 30). */
        @Permission(alias = "location", strings = { Manifest.permission.ACCESS_FINE_LOCATION })
    }
)
public class LampPlugin extends Plugin {

    /** Ein Faden für alles Senden — so überlagern sich nie zwei Werbungen. */
    private static final ExecutorService RADIO = Executors.newSingleThreadExecutor();
    /** So lange darf Android mit „gestartet" oder „ging nicht" brauchen. */
    private static final long CALLBACK_MS = 3000;
    private static final long FLUSH_MS = 250;

    private static final AdvertiseSettings SETTINGS = new AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
        .setConnectable(false)
        .setTimeout(0)
        .build();

    /** Jede Absage (Stopp, App verlassen) zählt hoch; ein Auftrag aus einer älteren Zählung endet. */
    private final AtomicInteger generation = new AtomicInteger();
    private volatile String cancelled = "stopped";
    private final Object wake = new Object();

    private final Handler main = new Handler(Looper.getMainLooper());
    /** Nur auf dem Hauptfaden. */
    private ScanCallback scanning;
    private int scanMinRssi = -127;
    private JSArray caught = new JSArray();
    private final Runnable flush = this::flushHeard;
    private final Runnable scanTimeout = () -> endScan("timeout", null);

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        /* Wer die App verlässt, sendet nicht weiter und hört nicht weiter zu. */
        cancel("paused");
        main.post(() -> endScan("paused", null));
    }

    @Override
    protected void handleOnDestroy() {
        cancel("paused");
        main.post(() -> endScan("paused", null));
        super.handleOnDestroy();
    }

    private BluetoothAdapter adapter() {
        BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        return manager == null ? null : manager.getAdapter();
    }

    private static String scanAlias() {
        return Build.VERSION.SDK_INT >= 31 ? "scan" : "location";
    }

    /** Bis Android 11 gibt es BLUETOOTH_ADVERTISE nicht — dort reicht, was bei der Installation erteilt wurde. */
    private PermissionState advertiseState() {
        return Build.VERSION.SDK_INT >= 31 ? getPermissionState("advertise") : PermissionState.GRANTED;
    }

    private boolean locationOn() {
        LocationManager location = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        return location != null && LocationManagerCompat.isLocationEnabled(location);
    }

    private static Object orNull(String text) {
        return text == null ? JSONObject.NULL : text;
    }

    /* -- Was das Telefon kann ----------------------------------------------------------------- */

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void support(PluginCall call) {
        BluetoothAdapter adapter = adapter();
        boolean enabled = adapter != null && adapter.isEnabled();
        JSObject out = new JSObject();
        out.put("bluetooth", adapter != null);
        out.put("le", getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE));
        out.put("enabled", enabled);
        out.put("advertiser", enabled && adapter.getBluetoothLeAdvertiser() != null);
        out.put("multiple", enabled && adapter.isMultipleAdvertisementSupported());
        out.put("extended", enabled && Build.VERSION.SDK_INT >= 26 && adapter.isLeExtendedAdvertisingSupported());
        out.put("maxLength", enabled && Build.VERSION.SDK_INT >= 26 ? adapter.getLeMaximumAdvertisingDataLength() : LampFrame.LEGACY_MAX);
        out.put("permission", advertiseState().toString());
        out.put("scanPermission", getPermissionState(scanAlias()).toString());
        out.put("scanner", enabled && adapter.getBluetoothLeScanner() != null);
        out.put("locationNeeded", Build.VERSION.SDK_INT < 31);
        out.put("locationOn", locationOn());
        out.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(out);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (advertiseState() == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias("advertise", call, "advertiseAnswered");
    }

    @PermissionCallback
    private void advertiseAnswered(PluginCall call) {
        granted(call, advertiseState() == PermissionState.GRANTED);
    }

    @PluginMethod
    public void requestScanPermission(PluginCall call) {
        if (getPermissionState(scanAlias()) == PermissionState.GRANTED) {
            granted(call, true);
            return;
        }
        requestPermissionForAlias(scanAlias(), call, "scanAnswered");
    }

    @PermissionCallback
    private void scanAnswered(PluginCall call) {
        granted(call, getPermissionState(scanAlias()) == PermissionState.GRANTED);
    }

    private static void granted(PluginCall call, boolean yes) {
        JSObject out = new JSObject();
        out.put("granted", yes);
        call.resolve(out);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_BLUETOOTH_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("Nie udało się otworzyć ustawień Bluetooth.");
        }
    }

    /* -- Senden -------------------------------------------------------------------------------- */

    @PluginMethod
    public void send(PluginCall call) {
        List<LampFrame> frames;
        try {
            frames = framesOf(call.getArray("frames"));
        } catch (Exception e) {
            call.resolve(outcome("bad-frame", e.getMessage(), System.currentTimeMillis(), new JSArray()));
            return;
        }
        /* Die Zählung JETZT: ein Stopp, der vor dem Start kommt, gilt auch für diesen Auftrag. */
        int gen = generation.get();
        RADIO.execute(() -> call.resolve(transmit(frames, gen)));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        cancel("stopped");
        JSObject out = new JSObject();
        out.put("stopped", true);
        call.resolve(out);
    }

    private void cancel(String reason) {
        cancelled = reason;
        generation.incrementAndGet();
        synchronized (wake) {
            wake.notifyAll();
        }
    }

    private static List<LampFrame> framesOf(JSONArray list) throws Exception {
        if (list == null || list.length() == 0) throw new IllegalArgumentException("Brak ramek do nadania.");
        if (list.length() > LampFrame.MAX_FRAMES) throw new IllegalArgumentException("Najwyżej " + LampFrame.MAX_FRAMES + " ramek.");
        List<LampFrame> out = new ArrayList<>();
        for (int i = 0; i < list.length(); i++) {
            JSONObject one = list.getJSONObject(i);
            out.add(LampFrame.of(one.getInt("manufacturerId"), one.getString("data"), one.optLong("durationMs", 1000), one.optLong("gapMs", 0)));
        }
        return out;
    }

    /** Warten, bis die Zeit um ist — {@code false}, wenn vorher abgesagt wurde. */
    private boolean hold(long ms, int gen) {
        long until = SystemClock.elapsedRealtime() + ms;
        synchronized (wake) {
            while (generation.get() == gen) {
                long left = until - SystemClock.elapsedRealtime();
                if (left <= 0) return true;
                try {
                    wake.wait(left);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return false;
                }
            }
        }
        return false;
    }

    private static String advertiseCode(int error) {
        switch (error) {
            case AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE: return "data-too-large";
            case AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS: return "too-many-advertisers";
            case AdvertiseCallback.ADVERTISE_FAILED_ALREADY_STARTED: return "already-started";
            case AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED: return "feature-unsupported";
            default: return "internal-error";
        }
    }

    private static JSObject outcome(String code, String detail, long startedAt, JSArray frames) {
        JSObject out = new JSObject();
        out.put("code", code);
        out.put("detail", orNull(detail));
        out.put("startedAt", startedAt);
        out.put("endedAt", System.currentTimeMillis());
        out.put("frames", frames);
        return out;
    }

    private static void stopQuietly(BluetoothLeAdvertiser advertiser, AdvertiseCallback callback) {
        try {
            advertiser.stopAdvertising(callback);
        } catch (RuntimeException ignored) {
            // Bluetooth inzwischen aus: dann wirbt auch nichts mehr.
        }
    }

    /** Auf {@link #RADIO}: die Ramki nacheinander. */
    @SuppressLint("MissingPermission")
    private JSObject transmit(List<LampFrame> frames, int gen) {
        long began = System.currentTimeMillis();
        JSArray done = new JSArray();
        if (generation.get() != gen) return outcome(cancelled, null, began, done);

        BluetoothAdapter adapter = adapter();
        if (adapter == null) return outcome("no-bluetooth", null, began, done);
        if (!adapter.isEnabled()) return outcome("bluetooth-off", null, began, done);
        if (advertiseState() != PermissionState.GRANTED) return outcome("no-permission", null, began, done);
        BluetoothLeAdvertiser advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) return outcome("no-advertiser", null, began, done);

        for (int i = 0; i < frames.size(); i++) {
            LampFrame frame = frames.get(i);
            JSObject one = new JSObject();
            one.put("index", i);
            one.put("requestedMs", frame.durationMs);
            done.put(one);

            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .addManufacturerData(frame.manufacturerId, frame.data)
                .build();

            CountDownLatch answered = new CountDownLatch(1);
            AtomicInteger failure = new AtomicInteger(Integer.MIN_VALUE);
            AdvertiseCallback callback = new AdvertiseCallback() {
                @Override
                public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                    failure.set(0);
                    answered.countDown();
                }

                @Override
                public void onStartFailure(int errorCode) {
                    failure.set(errorCode);
                    answered.countDown();
                }
            };

            long asked = SystemClock.elapsedRealtime();
            try {
                advertiser.startAdvertising(SETTINGS, data, callback);
            } catch (SecurityException e) {
                one.put("code", "no-permission");
                return outcome("no-permission", e.getMessage(), began, done);
            } catch (IllegalStateException e) {
                /* „BT Adapter is not turned ON" — zwischen der Prüfung und dem Start ausgeschaltet. */
                one.put("code", "bluetooth-off");
                return outcome("bluetooth-off", e.getMessage(), began, done);
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
                stopQuietly(advertiser, callback);
                one.put("code", "no-callback");
                return outcome("no-callback", "Brak AdvertiseCallback po " + CALLBACK_MS + " ms.", began, done);
            }
            if (failure.get() != 0) {
                String code = advertiseCode(failure.get());
                one.put("code", code);
                return outcome(code, "AdvertiseCallback.onStartFailure(" + failure.get() + ")", began, done);
            }

            one.put("startedAt", System.currentTimeMillis());
            boolean full = hold(frame.durationMs, gen);
            stopQuietly(advertiser, callback);
            one.put("stoppedAt", System.currentTimeMillis());
            one.put("heldMs", SystemClock.elapsedRealtime() - startedAt);
            one.put("code", full ? "ok" : cancelled);
            if (!full) return outcome(cancelled, null, began, done);

            if (i < frames.size() - 1 && frame.gapMs > 0 && !hold(frame.gapMs, gen)) {
                return outcome(cancelled, null, began, done);
            }
        }
        return outcome("ok", null, began, done);
    }

    /* -- Hören (vom Pilot lernen) ------------------------------------------------------------- */

    @PluginMethod
    public void startScan(PluginCall call) {
        int minRssi = call.getInt("minRssi", -127);
        long maxMs = Math.max(1000, Math.min(120_000, call.getInt("maxMs", 60_000)));
        main.post(() -> call.resolve(beginScan(minRssi, maxMs)));
    }

    @PluginMethod
    public void stopScan(PluginCall call) {
        main.post(() -> {
            JSObject out = new JSObject();
            out.put("stopped", endScan("stopped", null));
            call.resolve(out);
        });
    }

    private static JSObject scanAnswer(String code, String detail) {
        JSObject out = new JSObject();
        out.put("code", code);
        out.put("detail", orNull(detail));
        return out;
    }

    private static String scanCode(int error) {
        switch (error) {
            case ScanCallback.SCAN_FAILED_ALREADY_STARTED: return "already-started";
            case ScanCallback.SCAN_FAILED_APPLICATION_REGISTRATION_FAILED: return "registration-failed";
            case ScanCallback.SCAN_FAILED_FEATURE_UNSUPPORTED: return "feature-unsupported";
            case 5: return "out-of-resources";
            case 6: return "too-frequently";
            default: return "internal-error";
        }
    }

    /** Auf dem Hauptfaden. Ein laufender Scan endet zuerst (als „stopped"). */
    @SuppressLint("MissingPermission")
    private JSObject beginScan(int minRssi, long maxMs) {
        BluetoothAdapter adapter = adapter();
        if (adapter == null) return scanAnswer("no-bluetooth", null);
        if (!adapter.isEnabled()) return scanAnswer("bluetooth-off", null);
        if (getPermissionState(scanAlias()) != PermissionState.GRANTED) return scanAnswer("no-permission", null);
        if (Build.VERSION.SDK_INT < 31 && !locationOn()) return scanAnswer("location-off", null);
        BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
        if (scanner == null) return scanAnswer("no-scanner", null);

        endScan("stopped", null);
        ScanSettings settings = new ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
            .setReportDelay(0)
            .build();
        ScanCallback callback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                if (scanning == this) heard(result);
            }

            @Override
            public void onBatchScanResults(List<ScanResult> results) {
                if (scanning != this) return;
                for (ScanResult one : results) heard(one);
            }

            @Override
            public void onScanFailed(int errorCode) {
                main.post(() -> {
                    if (scanning == this) endScan(scanCode(errorCode), "ScanCallback.onScanFailed(" + errorCode + ")");
                });
            }
        };

        scanMinRssi = minRssi;
        caught = new JSArray();
        try {
            scanner.startScan(null, settings, callback);
        } catch (SecurityException e) {
            return scanAnswer("no-permission", e.getMessage());
        } catch (RuntimeException e) {
            return scanAnswer("error", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        scanning = callback;
        main.postDelayed(scanTimeout, maxMs);
        main.postDelayed(flush, FLUSH_MS);
        return scanAnswer("ok", null);
    }

    /** Ein Paket — der Zeitstempel ist der des Empfangs, nicht der des Rückrufs. */
    private void heard(ScanResult result) {
        if (result.getRssi() < scanMinRssi) return;
        ScanRecord record = result.getScanRecord();
        byte[] bytes = record == null ? null : record.getBytes();
        if (bytes == null || bytes.length == 0) return;
        JSObject one = new JSObject();
        one.put("address", result.getDevice() == null ? "?" : result.getDevice().getAddress());
        one.put("rssi", result.getRssi());
        one.put("hex", LampFrame.hex(bytes));
        long ageMs = Math.max(0, (SystemClock.elapsedRealtimeNanos() - result.getTimestampNanos()) / 1_000_000L);
        one.put("at", System.currentTimeMillis() - ageMs);
        one.put("name", orNull(record.getDeviceName()));
        caught.put(one);
        if (caught.length() >= 400) flushHeard();
    }

    private void flushHeard() {
        main.removeCallbacks(flush);
        if (caught.length() > 0) {
            JSObject event = new JSObject();
            event.put("packets", caught);
            caught = new JSArray();
            notifyListeners("lampScan", event);
        }
        if (scanning != null) main.postDelayed(flush, FLUSH_MS);
    }

    /** Auf dem Hauptfaden. {@code false}: es lief keiner. */
    @SuppressLint("MissingPermission")
    private boolean endScan(String code, String detail) {
        ScanCallback callback = scanning;
        if (callback == null) return false;
        scanning = null;
        main.removeCallbacks(scanTimeout);
        try {
            BluetoothAdapter adapter = adapter();
            BluetoothLeScanner scanner = adapter == null || !adapter.isEnabled() ? null : adapter.getBluetoothLeScanner();
            if (scanner != null) scanner.stopScan(callback);
        } catch (RuntimeException ignored) {
            // Bluetooth inzwischen aus: dann hört auch nichts mehr.
        }
        flushHeard();
        JSObject event = new JSObject();
        event.put("code", code);
        event.put("detail", orNull(detail));
        notifyListeners("lampScanEnd", event);
        return true;
    }
}
