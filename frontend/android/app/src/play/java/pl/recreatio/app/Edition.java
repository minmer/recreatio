package pl.recreatio.app;

import android.content.Context;
import android.content.Intent;
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

    /** Im Browser wartet eine SMS auf ein Telefon (0116) — diese Ausgabe sendet keine. */
    static void wake(Context context) {
    }

    /** Ein Start über ein eigenes Symbol der Ausgabe (2026-10-26) — diese hat keines. */
    static void adjust(Intent intent) {
    }
}
