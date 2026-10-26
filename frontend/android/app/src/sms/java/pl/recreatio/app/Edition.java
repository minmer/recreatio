package pl.recreatio.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
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

    /** Wohin das Symbol „SMS" führt — die Liste der Gespräche. */
    static final String SMS_ENTRY = "https://recreatio.pl/#/workspace/sms";

    /**
     * DAS SYMBOL „SMS" (2026-10-26) — ein zweites Symbol auf dem Startbildschirm
     * ({@code activity-alias .SmsLauncher}, dieselbe {@link MainActivity}). Es kommt als
     * MAIN/LAUNCHER an; hier wird daraus ein Link auf die SMS, den die Hülle wie jeden
     * anderen öffnet ({@code getLaunchUrl} beim Start, {@code appUrlOpen} danach). Wer in
     * den SMS schon ist, bleibt, wo er war ({@code shell.ts}).
     */
    static void adjust(Intent intent) {
        if (intent == null || intent.getComponent() == null) return;
        /* Der Startbildschirm schickt MAIN; ein Start ohne Aktion (eine Verknüpfung, adb -n) meint dasselbe. */
        if (intent.getAction() != null && !Intent.ACTION_MAIN.equals(intent.getAction())) return;
        if (!intent.getComponent().getClassName().endsWith(".SmsLauncher")) return;
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(SMS_ENTRY));
    }
}
