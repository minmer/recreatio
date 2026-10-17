package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

/**
 * IM HINTERGRUND (2026-10-17): das Archiv der SMS und das Adressbuch.
 *
 * <code>
 *   archive    was seit der Marke dazukam, versiegelt ins Netz — kurz nach
 *              jeder Nachricht ({@link #archiveSoon}) und zweimal am Tag
 *   contacts   die Kontakte aus recreatio ins Adressbuch des Telefons —
 *              zweimal am Tag (geänderte im Netz kommen so von selbst)
 * </code>
 *
 * <p>Getan wird es vom Läufer ({@link RunnerHost}: er hält die Schlüssel);
 * liegt der Schlüssel nicht auf dem Gerät, geschieht es beim nächsten Öffnen der
 * App.</p>
 */
public class PhoneWork extends Worker {

    private static final String TAG = "recreatio";
    private static final String PREFS = "recreatio.phone.work";
    private static final long RUN_MS = 8 * 60_000L;

    public PhoneWork(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private static Constraints online() {
        return new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
    }

    /** Zweimal am Tag beides — angelegt beim Start der App (bleibt, wenn es schon steht). */
    static void schedule(Context context) {
        PeriodicWorkRequest every = new PeriodicWorkRequest.Builder(PhoneWork.class, 12, TimeUnit.HOURS)
                .setConstraints(online())
                .setInputData(new Data.Builder().putString("kind", "both").build())
                .build();
        WorkManager.getInstance(context).enqueueUniquePeriodicWork("recreatio-phone", ExistingPeriodicWorkPolicy.KEEP, every);
    }

    /** Eine Nachricht kam oder ging: gleich (nach einer halben Minute, damit mehrere zusammenkommen) archivieren. */
    static void archiveSoon(Context context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean("again", true).apply();
        OneTimeWorkRequest soon = new OneTimeWorkRequest.Builder(PhoneWork.class)
                .setConstraints(online())
                .setInitialDelay(30, TimeUnit.SECONDS)
                .setInputData(new Data.Builder().putString("kind", "archive").build())
                .build();
        WorkManager.getInstance(context).enqueueUniqueWork("recreatio-phone-archive", ExistingWorkPolicy.KEEP, soon);
    }

    /** Die Kontakte gleich ins Adressbuch (nach einer Änderung im Netz, aus der App heraus). */
    static void contactsSoon(Context context) {
        OneTimeWorkRequest soon = new OneTimeWorkRequest.Builder(PhoneWork.class)
                .setConstraints(online())
                .setInputData(new Data.Builder().putString("kind", "contacts").build())
                .build();
        WorkManager.getInstance(context).enqueueUniqueWork("recreatio-phone-contacts", ExistingWorkPolicy.REPLACE, soon);
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        String kind = getInputData().getString("kind");
        if (kind == null) return Result.failure();
        boolean ok = true;
        if (kind.equals("archive") || kind.equals("both")) ok = archive(context);
        if (kind.equals("contacts") || kind.equals("both")) ok &= run(context, "contacts");
        if (ok || getRunAttemptCount() >= 2) return Result.success();
        return Result.retry();
    }

    /** Archivieren, bis während des Laufs nichts Neues mehr kam (höchstens dreimal). */
    private static boolean archive(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean ok = true;
        for (int round = 0; round < 3; round++) {
            prefs.edit().putBoolean("again", false).apply();
            ok = run(context, "archive");
            if (!ok || !prefs.getBoolean("again", false)) break;
        }
        return ok;
    }

    private static boolean run(Context context, String job) {
        try {
            JSONObject out = RunnerHost.run(context, new JSONObject().put("kind", "phone").put("job", job), RUN_MS);
            if (out.optBoolean("ok")) return true;
            String why = out.optString("error", "");
            Log.w(TAG, "phone " + job + ": " + why);
            /* Ohne Schlüssel oder Sitzung hilft Wiederholen nicht — das geschieht beim Öffnen der App. */
            return out.optBoolean("locked");
        } catch (Exception e) {
            Log.w(TAG, "phone " + job + " failed", e);
            return false;
        }
    }
}
