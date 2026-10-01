package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * PUSH (0075) — Firebase Cloud Messaging, nur als Wecker.
 *
 * <p><b>Ohne das Google-Services-Plugin.</b> Die Kennungen des
 * Firebase-Projekts liest der Bau aus {@code google-services.json} in
 * {@link BuildConfig}; hier wird Firebase damit von Hand gestartet. Fehlt die
 * Datei, gibt es keinen Push — die App fragt dann im Takt wie bisher
 * ({@link NotifyWorker}). Ebenso auf Telefonen ohne Google-Dienste.</p>
 *
 * <p><b>Erst, wenn Meldungen eingeschaltet sind.</b> Firebase holt sich seine
 * Gerätekennung nicht beim Start (Auto-Init ist im Manifest aus), sondern
 * erst, wenn die App den Arbeiter einrichtet ({@link NotifyPlugin#configure}).
 * Die Kennung geht mit dem Gerätekennzeichen an den Dienst
 * ({@code /notify/push-token}) — auch, wenn Firebase sie später bei
 * geschlossener App erneuert ({@link PushService#onNewToken}).</p>
 */
final class PushSetup {

    private PushSetup() {
    }

    /** Ist Firebase bereit? Startet es beim ersten Mal — mit den Kennungen aus dem Bau. */
    static synchronized boolean ready(Context context) {
        if (!FirebaseApp.getApps(context).isEmpty()) return true;
        if (BuildConfig.FCM_APP_ID.isEmpty() || BuildConfig.FCM_PROJECT_ID.isEmpty()) return false;
        try {
            FirebaseOptions options = new FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FCM_APP_ID)
                    .setApiKey(BuildConfig.FCM_API_KEY)
                    .setProjectId(BuildConfig.FCM_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FCM_SENDER_ID)
                    .build();
            FirebaseApp.initializeApp(context, options);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Einschalten: die Kennung holen und dem Dienst melden. */
    static boolean start(Context context) {
        if (!ready(context)) return false;
        try {
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(true);
            messaging.getToken().addOnCompleteListener(task -> {
                if (task.isSuccessful() && task.getResult() != null) remember(context, task.getResult());
            });
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /** Ausschalten: die Kennung bei Firebase löschen (der Dienst hat das Gerät dann ohnehin zurückgezogen). */
    static void stop(Context context) {
        if (FirebaseApp.getApps(context).isEmpty()) return;
        try {
            FirebaseMessaging messaging = FirebaseMessaging.getInstance();
            messaging.setAutoInitEnabled(false);
            messaging.deleteToken();
        } catch (Exception ignored) {
            // Ohne Firebase gibt es nichts zu löschen.
        }
    }

    /** Eine (neue) Kennung behalten und dem Dienst melden — im Hintergrund, nie auf dem Hauptfaden. */
    static void remember(Context context, String pushToken) {
        prefs(context).edit().putString("pushToken", pushToken).apply();
        new Thread(() -> send(context)).start();
    }

    /** Die Kennung an den Dienst. Ohne Gerät (noch nicht eingerichtet) wartet sie, bis {@link #start} sie schickt. */
    static void send(Context context) {
        SharedPreferences prefs = prefs(context);
        String api = prefs.getString("api", null);
        String device = prefs.getString("token", null);
        String push = prefs.getString("pushToken", null);
        if (api == null || device == null || push == null) return;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(api + "/notify/push-token").openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("X-Notify-Token", device);
            byte[] body = new JSONObject().put("pushToken", push).toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body);
            }
            if (connection.getResponseCode() == 200) prefs.edit().putString("pushSent", push).apply();
        } catch (Exception ignored) {
            // Beim nächsten Start (oder der nächsten neuen Kennung) noch einmal.
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    /** Ist der Wecker gestellt — Kennung da und beim Dienst angekommen? */
    static boolean active(Context context) {
        SharedPreferences prefs = prefs(context);
        String push = prefs.getString("pushToken", null);
        return push != null && push.equals(prefs.getString("pushSent", null));
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NotifyWorker.PREFS, Context.MODE_PRIVATE);
    }
}
