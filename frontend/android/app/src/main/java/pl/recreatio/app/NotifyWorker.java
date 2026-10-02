package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.util.ArrayList;
import java.util.List;

/**
 * IM HINTERGRUND NACHSEHEN (0067) — wenn die App zu ist.
 *
 * <p>Android ruft diesen Arbeiter höchstens alle 15 Minuten, nur mit Netz und
 * nur, wenn der Akku nicht schwach ist — so legt {@link NotifyPlugin} ihn an.
 * Er ist das Netz unter dem Wecker von Firebase (0075): kommt kein Signal (kein
 * Google auf dem Telefon, oder es ging verloren), meldet sich das Neue
 * spätestens hier.</p>
 *
 * <p>0076 — nachgesehen wird wie beim Wecker ({@link Inbox#check}): mit
 * Inhalt, wo der Schlüssel auf dem Gerät liegt, sonst nur die ZAHLEN
 * ({@link #counts}). Gemeldet wird nur, was über das hinaus neu ist, was die
 * App zuletzt gezeigt hat ({@code seen}).</p>
 */
public class NotifyWorker extends Worker {

    static final String PREFS = "recreatio.notify";

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
        return Inbox.check(context, false) == Outcome.RETRY ? Result.retry() : Result.success();
    }

    /**
     * NUR DIE ZAHLEN — wenn der Inhalt nicht aufgeht (strenge Betriebsart,
     * keine Sitzung) oder ausgeschaltet ist. Was gemeldet ist, gilt als gesehen.
     */
    static void counts(Context context, int loud, int forms, int links) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int seenLoud = prefs.getInt("seenLoud", 0);
        int seenForms = prefs.getInt("seenForms", 0);
        int seenLinks = prefs.getInt("seenLinks", 0);

        List<String> lines = new ArrayList<>();
        if (prefs.getBoolean("chats", true) && loud > seenLoud) lines.add(loud == 1 ? "1 nowa wiadomość" : loud + " nowych wiadomości");
        if (prefs.getBoolean("forms", true) && forms > seenForms) lines.add(forms == 1 ? "1 nowe zgłoszenie" : forms + " nowych zgłoszeń");
        if (prefs.getBoolean("links", true) && links > seenLinks) lines.add(links == 1 ? "1 osoba dołączyła przez link" : links + " osób dołączyło przez link");

        prefs.edit().putInt("seenLoud", loud).putInt("seenForms", forms).putInt("seenLinks", links).apply();
        if (lines.isEmpty()) return;

        boolean chat = loud > seenLoud;
        Notices.ensureChannels(context);
        Notices.post(context, Notices.COUNTS_ID, new NotificationCompat.Builder(context, chat ? Notices.CHANNEL_CHAT : Notices.CHANNEL_NEWS)
                .setSmallIcon(R.drawable.ic_stat_recreatio)
                .setContentTitle("recreatio")
                .setContentText(String.join(" · ", lines))
                .setAutoCancel(true)
                .setContentIntent(Notices.openIntent(context, chat ? "#/workspace/chat" : "#/workspace", Notices.COUNTS_ID))
                .setPriority(chat ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
                .setCategory(chat ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_STATUS)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE));
    }
}
