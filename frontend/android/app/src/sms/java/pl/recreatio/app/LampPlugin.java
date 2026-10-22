package pl.recreatio.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
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

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

/**
 * DER SENDER FÜR DIE LAMPEN (Ausgabe „sms", 2026-10-18) — `lamps/native.ts`.
 *
 * <code>
 *   support, requestPermission, send, release, stop, openSettings
 *   requestScanPermission, startScan, stopScan   (Ereignisse lampScan, lampScanEnd)
 *   setTimers, timerStatus, setTimersOn          (die Timer: {@link LampTimers})
 * </code>
 *
 * <p><b>Senden</b> macht {@link LampRadio} — eine echte BLE-Werbung, ein Auftrag nach dem
 * anderen auf einem Faden, zusammen mit den Timern. Für die Seite gilt: „Stopp" und das
 * Verlassen der App erhöhen {@link #generation} — der laufende Auftrag stoppt sofort,
 * schon wartende enden, ohne zu senden. Einen Timer hält das nicht auf.</p>
 *
 * <p><b>Gehalten</b> (2026-10-21): {@code send} mit {@code hold} sendet, bis {@code release}
 * kommt (der Knopf auf der Seite wurde losgelassen) — {@link LampRadio.Press}.</p>
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

    private static final long FLUSH_MS = 250;

    /** Jede Absage (Stopp, App verlassen) zählt hoch; ein Auftrag aus einer älteren Zählung endet. */
    private final AtomicInteger generation = new AtomicInteger();
    private volatile String cancelled = "stopped";
    private final Object wake = new Object();
    /** Der Knopf, der gerade gehalten wird (höchstens einer — die Seite sendet nacheinander). */
    private volatile LampRadio.Press pressing;

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
        /* Wer die App verlässt, sendet nicht weiter und hört nicht weiter zu (die Timer gehen weiter). */
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
        return LampRadio.adapter(getContext());
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
        return LampRadio.orNull(text);
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
            frames = LampRadio.framesOf(call.getArray("frames"));
        } catch (Exception e) {
            call.resolve(LampRadio.outcome("bad-frame", e.getMessage(), System.currentTimeMillis(), new JSArray()));
            return;
        }
        /* Die Zählung JETZT: ein Stopp, der vor dem Start kommt, gilt auch für diesen Auftrag. */
        int gen = generation.get();
        /* Gehalten: schon jetzt bekannt — ein Loslassen, das vor dem Start kommt, findet ihn. */
        LampRadio.Press press = Boolean.TRUE.equals(call.getBoolean("hold", false)) ? new LampRadio.Press() : null;
        if (press != null) pressing = press;
        Context context = getContext().getApplicationContext();
        LampRadio.RADIO.execute(() -> {
            JSObject out = LampRadio.transmit(context, frames, cancelOf(gen), press);
            if (press != null && pressing == press) pressing = null;
            call.resolve(out);
        });
    }

    /** Der gehaltene Knopf wurde losgelassen: {@code heldMs} — wie lange er gedrückt war. */
    @PluginMethod
    public void release(PluginCall call) {
        LampRadio.Press press = pressing;
        Integer heldMs = call.getInt("heldMs", 0);
        if (press != null) press.release(SystemClock.elapsedRealtime(), heldMs == null ? 0 : heldMs);
        synchronized (wake) {
            wake.notifyAll();
        }
        JSObject out = new JSObject();
        out.put("released", press != null);
        call.resolve(out);
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

    /** Ein Auftrag der Seite: abgesagt, sobald {@link #generation} weiterzählt. */
    private LampRadio.Cancel cancelOf(int gen) {
        return new LampRadio.Cancel() {
            @Override
            public boolean hold(long ms) {
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

            @Override
            public boolean waitUntil(BooleanSupplier done) {
                synchronized (wake) {
                    while (generation.get() == gen) {
                        if (done.getAsBoolean()) return true;
                        try {
                            wake.wait(LampRadio.WAIT_STEP_MS);
                        } catch (InterruptedException e) {
                            Thread.currentThread().interrupt();
                            return false;
                        }
                    }
                }
                return false;
            }

            @Override
            public boolean cancelled() {
                return generation.get() != gen;
            }

            @Override
            public String reason() {
                return cancelled;
            }
        };
    }

    /* -- Timer ---------------------------------------------------------------------------------- */

    /** Den Plan ablegen (die Seite rechnet ihn aus den Timern); {@code enable}: auf diesem Telefon ein/aus. */
    @PluginMethod
    public void setTimers(PluginCall call) {
        JSONArray timers = call.getArray("timers", new JSArray());
        Boolean enable = call.getBoolean("enable");
        Context context = getContext().getApplicationContext();
        if (enable != null) LampTimers.setOn(context, enable);
        LampTimers.store(context, timers);
        call.resolve(LampTimers.status(context));
    }

    @PluginMethod
    public void timerStatus(PluginCall call) {
        call.resolve(LampTimers.status(getContext().getApplicationContext()));
    }

    @PluginMethod
    public void setTimersOn(PluginCall call) {
        Context context = getContext().getApplicationContext();
        LampTimers.setOn(context, Boolean.TRUE.equals(call.getBoolean("on", false)));
        call.resolve(LampTimers.status(context));
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
