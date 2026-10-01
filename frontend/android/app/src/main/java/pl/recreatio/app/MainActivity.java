package pl.recreatio.app;

import android.os.Bundle;
import android.webkit.CookieManager;

import com.getcapacitor.BridgeActivity;

/**
 * Die Hülle: eine WebView mit der gebauten Seite, und drei Dinge, die eine
 * Seite allein nicht kann — einen Schlüsselspeicher im Gerät
 * ({@link KeyVaultPlugin}), das Ablegen einer Datei ({@link FileSaverPlugin}) und
 * das Nachsehen im Hintergrund ({@link NotifyPlugin}, 0067).
 *
 * Die eigenen Bausteine müssen VOR {@code super.onCreate} angemeldet sein:
 * dort entsteht die Brücke, und was danach kommt, kennt sie nicht.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KeyVaultPlugin.class);
        registerPlugin(FileSaverPlugin.class);
        /* 0067 — im Hintergrund nachsehen, wenn die App zu ist ({@link NotifyWorker}). */
        registerPlugin(NotifyPlugin.class);
        super.onCreate(savedInstanceState);
    }

    /**
     * Das Sitzungskeks auf die Platte, sobald die App in den Hintergrund geht.
     *
     * Die WebView schreibt Kekse nur alle paar Sekunden weg. Beendet Android
     * die App im Hintergrund vorher, ist die Anmeldung fort — und beim nächsten
     * Öffnen stünde man vor dem Anmeldeformular, obwohl der Schlüssel verwahrt ist.
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }
}
