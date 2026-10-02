package pl.recreatio.app;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.OutOfQuotaPolicy;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONObject;

import java.io.IOException;
import java.util.concurrent.TimeoutException;

/**
 * EIN AUFTRAG FÜR DEN LÄUFER (0076) — als Eilauftrag des Systems, damit er
 * auch bei geschlossener App gleich läuft:
 *
 * <code>
 *   check   nachsehen und zeigen (der Wecker von Firebase, {@link Inbox#check})
 *   reply   eine Antwort aus der Meldung senden
 *   read    „Przeczytane"
 *   done    „Zrobione" an einer Erinnerung
 * </code>
 *
 * <p>Eilaufträge gibt es ab Android 12; davor läuft derselbe Auftrag als
 * gewöhnlicher (er braucht dort sonst einen Dienst im Vordergrund).</p>
 */
public class RichWork extends Worker {

    private static final String TAG = "recreatio";
    static final String WORK_CHECK = "recreatio-rich-check";
    private static final long RUN_MS = 45_000;

    public RichWork(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    private static void enqueue(Context context, String unique, ExistingWorkPolicy policy, Data data) {
        OneTimeWorkRequest.Builder builder = new OneTimeWorkRequest.Builder(RichWork.class)
                .setInputData(data)
                .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build());
        if (Build.VERSION.SDK_INT >= 31) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST);
        WorkManager.getInstance(context).enqueueUniqueWork(unique, policy, builder.build());
    }

    /** Der Wecker: gleich nachsehen. Kommt er, während schon nachgesehen wird, folgt ein zweiter Durchgang. */
    static void check(Context context) {
        Inbox.again(context);
        enqueue(context, WORK_CHECK, ExistingWorkPolicy.KEEP, new Data.Builder().putString("kind", "check").build());
    }

    static void reply(Context context, String chatId, String messageId, String text) {
        enqueue(context, "recreatio-reply-" + messageId, ExistingWorkPolicy.KEEP, new Data.Builder()
                .putString("kind", "reply").putString("chatId", chatId).putString("messageId", messageId).putString("text", text).build());
    }

    static void read(Context context, String chatId) {
        enqueue(context, "recreatio-read-" + chatId, ExistingWorkPolicy.REPLACE, new Data.Builder()
                .putString("kind", "read").putString("chatId", chatId).build());
    }

    static void done(Context context, String tag, String taskId, String occurrenceAt) {
        enqueue(context, "recreatio-done-" + tag, ExistingWorkPolicy.KEEP, new Data.Builder()
                .putString("kind", "done").putString("tag", tag).putString("taskId", taskId).putString("occurrenceAt", occurrenceAt).build());
    }

    @NonNull
    @Override
    public Result doWork() {
        Context context = getApplicationContext();
        Data in = getInputData();
        String kind = in.getString("kind");
        if (kind == null) return Result.failure();
        try {
            switch (kind) {
                case "check":
                    return Inbox.checkUntilQuiet(context) == NotifyWorker.Outcome.RETRY ? Result.retry() : Result.success();
                case "reply":
                    return reply(context, in);
                case "read": {
                    JSONObject out = RunnerHost.run(context, new JSONObject().put("kind", "read").put("chatId", in.getString("chatId")), RUN_MS);
                    return out.optBoolean("ok") || getRunAttemptCount() >= 2 ? Result.success() : Result.retry();
                }
                case "done":
                    return done(context, in);
                default:
                    return Result.failure();
            }
        } catch (Exception e) {
            Log.w(TAG, "rich work " + kind + " failed", e);
            return getRunAttemptCount() >= 2 ? Result.failure() : Result.retry();
        }
    }

    /**
     * Die Antwort senden. Bricht es unterwegs ab, wird es noch zweimal versucht —
     * mit derselben Kennung, der Läufer schickt also nie doppelt.
     */
    private Result reply(Context context, Data in) throws Exception {
        String chatId = in.getString("chatId");
        String messageId = in.getString("messageId");
        String text = in.getString("text");
        if (chatId == null || messageId == null || text == null) return Result.failure();
        try {
            JSONObject out = RunnerHost.run(context, new JSONObject()
                    .put("kind", "reply").put("chatId", chatId).put("messageId", messageId).put("text", text), RUN_MS);
            boolean ok = out.optBoolean("ok");
            Notices.replied(context, chatId, messageId, text, ok, ok ? null : out.optString("error"));
            return Result.success();
        } catch (TimeoutException | IOException e) {
            if (getRunAttemptCount() < 2) return Result.retry();
            Notices.replied(context, chatId, messageId, text, false, "brak połączenia");
            return Result.failure();
        }
    }

    private Result done(Context context, Data in) throws Exception {
        String tag = in.getString("tag");
        String taskId = in.getString("taskId");
        if (tag == null || taskId == null) return Result.failure();
        try {
            JSONObject task = new JSONObject().put("kind", "done").put("taskId", taskId);
            String occurrenceAt = in.getString("occurrenceAt");
            task.put("occurrenceAt", occurrenceAt == null ? JSONObject.NULL : occurrenceAt);
            JSONObject out = RunnerHost.run(context, task, RUN_MS);
            boolean ok = out.optBoolean("ok");
            Reminders.done(context, tag, ok, ok ? null : out.optString("error"));
            return Result.success();
        } catch (TimeoutException | IOException e) {
            if (getRunAttemptCount() < 2) return Result.retry();
            Reminders.done(context, tag, false, "brak połączenia");
            return Result.failure();
        }
    }
}
