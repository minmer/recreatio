package pl.recreatio.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * EINE DATEI ABLEGEN — was im Browser {@code <a download>} tut.
 *
 * Eine WebView lädt nichts herunter, und schon gar kein {@code blob:}: das
 * liegt im Speicher der Seite, an den hier niemand herankommt. Die Seite
 * reicht die Bytes deshalb selbst herüber, in Stücken.
 *
 * <code>
 *   begin(name, mime)  der Mensch wählt, WO — das System fragt, nicht die App
 *   append(data)       ein Stück, Base64 (bis 50 MB kommen so an, ohne dass
 *                      ein einzelner Aufruf das Ganze tragen muss)
 *   end() / abort()    fertig — oder die halbe Datei wieder fort
 * </code>
 *
 * Ohne Speicherberechtigung: der Dokumentenwähler gibt genau die eine Datei
 * frei, die der Mensch gerade benannt hat.
 */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    private static final class Target {
        final Uri uri;
        final OutputStream out;

        Target(Uri uri, OutputStream out) {
            this.uri = uri;
            this.out = out;
        }
    }

    private final Map<String, Target> open = new ConcurrentHashMap<>();

    @PluginMethod
    public void begin(PluginCall call) {
        String name = call.getString("name", "plik");
        String mime = call.getString("mime", "");

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime)
            .putExtra(Intent.EXTRA_TITLE, name == null || name.isEmpty() ? "plik" : name);

        startActivityForResult(call, intent, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            /* Abgebrochen ist kein Fehler: ohne `handle` weiss die Seite, dass nichts zu schreiben ist. */
            call.resolve(new JSObject());
            return;
        }

        Uri uri = data.getData();
        try {
            OutputStream out = getContext().getContentResolver().openOutputStream(uri, "w");
            if (out == null) throw new IOException("no stream");

            String handle = UUID.randomUUID().toString();
            open.put(handle, new Target(uri, out));

            JSObject done = new JSObject();
            done.put("handle", handle);
            call.resolve(done);
        } catch (IOException | SecurityException e) {
            call.reject("Nie udało się utworzyć pliku.", e);
        }
    }

    @PluginMethod
    public void append(PluginCall call) {
        Target target = open.get(call.getString("handle", ""));
        String data = call.getString("data");
        if (target == null || data == null) {
            call.reject("Plik nie jest otwarty.");
            return;
        }

        try {
            target.out.write(Base64.decode(data, Base64.DEFAULT));
            call.resolve();
        } catch (IOException | IllegalArgumentException e) {
            discard(call.getString("handle", ""));
            call.reject("Nie udało się zapisać pliku.", e);
        }
    }

    @PluginMethod
    public void end(PluginCall call) {
        Target target = open.remove(call.getString("handle", ""));
        if (target == null) {
            call.reject("Plik nie jest otwarty.");
            return;
        }

        try {
            target.out.close();
            call.resolve();
        } catch (IOException e) {
            call.reject("Nie udało się zapisać pliku.", e);
        }
    }

    @PluginMethod
    public void abort(PluginCall call) {
        discard(call.getString("handle", ""));
        call.resolve();
    }

    /** Die halbe Datei bleibt nicht liegen. */
    private void discard(String handle) {
        Target target = open.remove(handle);
        if (target == null) return;

        try {
            target.out.close();
        } catch (IOException ignored) {
            /* Sie wird gleich gelöscht. */
        }
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), target.uri);
        } catch (Exception ignored) {
            /* Dann bleibt eine leere Datei — das sieht der Mensch, und er hat sie selbst benannt. */
        }
    }
}
