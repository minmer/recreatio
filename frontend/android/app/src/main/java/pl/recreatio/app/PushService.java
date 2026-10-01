package pl.recreatio.app;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

/**
 * DER WECKER (0075). Firebase bringt nur {@code {"kind":"check"}} — dann wird
 * nachgesehen wie im Hintergrund ({@link NotifyWorker#check}): die Zahlen vom
 * Dienst, und eine Meldung, wenn etwas über das Gesehene hinaus neu ist.
 *
 * <p><b>Ist die App vorn</b>, entscheidet die Seite: sie holt sofort neu und
 * meldet nur, was nicht ohnehin auf dem Bildschirm steht (die offene Rozmowa
 * nicht). Sonst klingelte das Telefon für die Nachricht, die man gerade liest.</p>
 *
 * <p>Beide Rückrufe laufen nicht auf dem Hauptfaden — das Fragen darf hier warten.</p>
 */
public class PushService extends FirebaseMessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        if (!"check".equals(message.getData().get("kind"))) return;
        if (MainActivity.inFront && NotifyPlugin.tellPage()) return;
        NotifyWorker.check(getApplicationContext());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        PushSetup.remember(getApplicationContext(), token);
    }
}
