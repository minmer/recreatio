package pl.recreatio.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * DIE AUSGABE „sms" (2026-10-17) — die App für EIN Telefon: dazu kommen die
 * SMS-App ({@link PhonePlugin}, {@link SmsReceiver}, {@link MmsReceiver}), das
 * Adressbuch ({@link PhoneContacts}) und das Archiv ({@link PhoneWork}); seit
 * 2026-10-18 auch der Sender für die Lampen ({@link LampPlugin}, Bluetooth LE).
 *
 * <p>In {@code src/play/} steht dieselbe Klasse leer: die gewöhnliche App weiss
 * davon nichts, und ihr Manifest nennt keine dieser Rechte.</p>
 */
final class Edition {

    static final String RUNNER_BRIDGE = "RecreatioPhone";

    private Edition() {
    }

    static void register(BridgeActivity activity) {
        activity.registerPlugin(PhonePlugin.class);
        /* 2026-10-18 — Lampy: Sygnały als BLE-Werbung senden und vom Pilot lernen. */
        activity.registerPlugin(LampPlugin.class);
        /* Der Abgleich im Hintergrund — das Archiv und das Adressbuch, auch wenn die App nie geöffnet wird. */
        PhoneWork.schedule(activity.getApplicationContext());
    }

    /** Der Läufer darf die Nachrichten lesen und das Adressbuch schreiben — für das Archiv im Hintergrund. */
    @SuppressLint("AddJavascriptInterface")
    static void runner(WebView web, Context context) {
        web.addJavascriptInterface(new PhoneBridge(context.getApplicationContext()), RUNNER_BRIDGE);
    }

    static void runnerGone(WebView web) {
        web.removeJavascriptInterface(RUNNER_BRIDGE);
    }

    /** Der Dienst meldet: im Browser wartet eine SMS auf dieses Telefon (0116). */
    static void wake(Context context) {
        PhoneWork.outboxSoon(context.getApplicationContext());
    }
}
