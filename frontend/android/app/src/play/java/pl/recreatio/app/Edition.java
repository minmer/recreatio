package pl.recreatio.app;

import android.content.Context;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/**
 * DIE GEWÖHNLICHE AUSGABE (Google Play, die APK für alle): nichts dazu.
 *
 * <p>Dieselbe Klasse steht in {@code src/sms/} — dort meldet sie das Telefon
 * an (SMS, MMS, Adressbuch). Hier bleibt die Hülle, wie sie ist.</p>
 */
final class Edition {

    private Edition() {
    }

    /** Eigene Bausteine der Ausgabe — vor {@code super.onCreate} der Hülle. */
    static void register(BridgeActivity activity) {
    }

    /** Was der Läufer zusätzlich darf ({@link RunnerHost}). */
    static void runner(WebView web, Context context) {
    }

    static void runnerGone(WebView web) {
    }
}
