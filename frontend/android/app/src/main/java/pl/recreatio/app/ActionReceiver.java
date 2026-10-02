package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.RemoteInput;

/**
 * WAS DER MENSCH AN EINER MELDUNG TUT (0076): antworten, „Przeczytane",
 * „Zrobione", wegwischen.
 *
 * <p>Hier geschieht nur das Sichtbare, sofort — die Antwort steht im Gespräch
 * („wysyłanie…"), die Meldung geht weg. Das Eigentliche (versiegeln,
 * unterschreiben, senden) macht der Läufer in einem Auftrag ({@link RichWork}):
 * ein Empfänger hat nur Sekunden.</p>
 */
public class ActionReceiver extends BroadcastReceiver {

    static final String ACTION_REPLY = "pl.recreatio.app.REPLY";
    static final String ACTION_READ = "pl.recreatio.app.READ";
    static final String ACTION_DISMISS = "pl.recreatio.app.DISMISS";
    static final String ACTION_DONE = "pl.recreatio.app.DONE";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        Context app = context.getApplicationContext();
        try {
            switch (action) {
                case ACTION_REPLY: {
                    String chatId = intent.getStringExtra("chatId");
                    Bundle input = RemoteInput.getResultsFromIntent(intent);
                    CharSequence typed = input == null ? null : input.getCharSequence(Notices.KEY_REPLY);
                    String text = typed == null ? "" : typed.toString().trim();
                    if (chatId == null || text.isEmpty()) return;
                    String messageId = Notices.newId();
                    Notices.replying(app, chatId, messageId, text);
                    RichWork.reply(app, chatId, messageId, text);
                    break;
                }
                case ACTION_READ: {
                    String chatId = intent.getStringExtra("chatId");
                    if (chatId == null) return;
                    Notices.dismissChat(app, chatId);
                    RichWork.read(app, chatId);
                    break;
                }
                case ACTION_DISMISS: {
                    String chatId = intent.getStringExtra("chatId");
                    if (chatId != null) Notices.dismissed(app, chatId);
                    break;
                }
                case ACTION_DONE: {
                    String tag = intent.getStringExtra("tag");
                    String taskId = intent.getStringExtra("taskId");
                    if (tag == null || taskId == null || taskId.isEmpty()) return;
                    Reminders.doing(app, tag);
                    RichWork.done(app, tag, taskId, intent.getStringExtra("occurrenceAt"));
                    break;
                }
                default:
                    break;
            }
        } catch (Exception e) {
            Log.w("recreatio", "notification action failed", e);
        }
    }
}
