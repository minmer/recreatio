package pl.recreatio.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * NUR IM DEBUG-BAU (0076): tut, was ein Wecksignal von Firebase täte — für
 * Emulatoren ohne Google-Dienste. Siehe {@code src/debug/AndroidManifest.xml}.
 */
public class DebugWake extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (MainActivity.inFront && NotifyPlugin.tellPage()) return;
        RichWork.check(context.getApplicationContext());
    }
}
