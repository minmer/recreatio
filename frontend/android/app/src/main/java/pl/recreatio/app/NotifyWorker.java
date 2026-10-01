package pl.recreatio.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * IM HINTERGRUND NACHSEHEN (0067) — wenn die App zu ist.
 *
 * <p>Android ruft diesen Arbeiter höchstens alle 15 Minuten (eingestellt sind
 * meist 30), nur mit Netz und nur, wenn der Akku nicht schwach ist — so legt
 * {@link NotifyPlugin} ihn an. Er fragt {@code /notify/digest} mit dem
 * Gerätekennzeichen und bekommt nur ZAHLEN: ungelesene Nachrichten, neue
 * Anmeldungen, eingelöste Links. Inhalte liegen versiegelt und gingen hier
 * ohnehin nicht auf.</p>
 *
 * <p><b>Gemeldet wird nur, was über das hinaus neu ist, was die App zuletzt
 * gezeigt hat</b> ({@code seen}) — sonst klingelte das Telefon für etwas, das
 * man gerade gelesen hat. Ein 401 heisst: das Gerät wurde abgemeldet; dann
 * hört der Arbeiter auf.</p>
 */
public class NotifyWorker extends Worker {

    static final String PREFS = "recreatio.notify";
    static final String CHANNEL = "news";
    /** Dieselbe wie die der Seite ({@code platform.ts}): Rozmowy, mit Aufpoppen. */
    static final String CHANNEL_CHAT = "chat";

    /** Wie ein Nachsehen ausging. */
    enum Outcome { DONE, RETRY }

    public NotifyWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        /* 0075 — eine Kennung, die beim letzten Mal nicht ankam, geht jetzt nach. */
        if (!PushSetup.active(context)) PushSetup.send(context);
        return check(context) == Outcome.RETRY ? Result.retry() : Result.success();
    }

    /**
     * NACHSEHEN — vom Arbeiter im Takt und vom Wecker ({@link PushService}).
     * Die Zahlen vom Dienst; gemeldet wird, was über das Gesehene hinaus neu ist.
     */
    static synchronized Outcome check(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String api = prefs.getString("api", null);
        String token = prefs.getString("token", null);
        if (api == null || token == null) return Outcome.DONE;

        String since = prefs.getString("since", "");
        HttpURLConnection connection = null;
        try {
            String address = api + "/notify/digest" + (since.isEmpty() ? "" : "?since=" + URLEncoder.encode(since, "UTF-8"));
            connection = (HttpURLConnection) new URL(address).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(20000);
            connection.setRequestProperty("X-Notify-Token", token);
            connection.setRequestProperty("Accept", "application/json");

            int status = connection.getResponseCode();
            if (status == 401) {
                /* Abgemeldet oder zurückgezogen — nicht weiter fragen. */
                prefs.edit().remove("token").apply();
                return Outcome.DONE;
            }
            if (status != 200) return Outcome.RETRY;

            JSONObject digest = new JSONObject(read(connection.getInputStream()));
            int loud = digest.getJSONObject("chats").optInt("loud", 0);
            int forms = digest.getJSONObject("registrations").optInt("count", 0);
            int links = digest.optInt("links", 0);

            int seenLoud = prefs.getInt("seenLoud", 0);
            int seenForms = prefs.getInt("seenForms", 0);
            int seenLinks = prefs.getInt("seenLinks", 0);

            List<String> lines = new ArrayList<>();
            if (prefs.getBoolean("chats", true) && loud > seenLoud) lines.add(loud == 1 ? "1 nowa wiadomość" : loud + " nowych wiadomości");
            if (prefs.getBoolean("forms", true) && forms > seenForms) lines.add(forms == 1 ? "1 nowe zgłoszenie" : forms + " nowych zgłoszeń");
            if (prefs.getBoolean("links", true) && links > seenLinks) lines.add(links == 1 ? "1 osoba dołączyła przez link" : links + " osób dołączyło przez link");

            /* Was gemeldet ist, gilt als gesehen — dasselbe meldet sich nicht zweimal. */
            prefs.edit().putInt("seenLoud", loud).putInt("seenForms", forms).putInt("seenLinks", links).apply();

            if (!lines.isEmpty()) show(context, String.join(" · ", lines), loud > seenLoud ? "#/workspace/chat" : "#/workspace", loud > seenLoud);
            return Outcome.DONE;
        } catch (Exception e) {
            return Outcome.RETRY;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String read(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int n;
        while ((n = in.read(buffer)) > 0) out.write(buffer, 0, n);
        in.close();
        return out.toString(StandardCharsets.UTF_8.name());
    }

    private static void show(Context context, String text, String open, boolean chat) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        /* Nachrichten auf dem Kanal der Rozmowy (mit Aufpoppen), alles andere unter „Nowości". */
        String channel = chat ? CHANNEL_CHAT : CHANNEL;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null && manager.getNotificationChannel(channel) == null) {
                manager.createNotificationChannel(chat
                        ? new NotificationChannel(CHANNEL_CHAT, "Rozmowy", NotificationManager.IMPORTANCE_HIGH)
                        : new NotificationChannel(CHANNEL, "Nowości", NotificationManager.IMPORTANCE_DEFAULT));
            }
        }

        /* Ein Tippen öffnet die App an der passenden Stelle — wie ein Link auf recreatio.pl. */
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://recreatio.pl/" + open), context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 7, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int icon = context.getResources().getIdentifier("ic_stat_recreatio", "drawable", context.getPackageName());
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
                .setSmallIcon(icon != 0 ? icon : context.getApplicationInfo().icon)
                .setContentTitle("recreatio")
                .setContentText(text)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .setPriority(chat ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(chat ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_STATUS)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE);

        try {
            NotificationManagerCompat.from(context).notify(7700, builder.build());
        } catch (SecurityException ignored) {
            // Ohne Erlaubnis keine Meldung — kein Absturz.
        }
    }
}
