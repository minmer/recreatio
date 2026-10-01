package pl.recreatio.app;

import android.app.Application;

/**
 * Die Anwendung selbst — damit Firebase steht, bevor ein Wecksignal kommt
 * (0075). Ein Push kann die App starten, ohne dass eine Seite geöffnet wird;
 * dann gibt es nur diesen Ort, an dem Firebase vorher bereit sein kann.
 */
public class RecreatioApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        PushSetup.ready(this);
    }
}
