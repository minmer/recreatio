package pl.recreatio.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * DER LÄUFER (0076) — eine unsichtbare WebView mit der eigenen Seite.
 *
 * <p><b>Warum eine WebView und kein Java.</b> Eine Nachricht zu öffnen heisst:
 * Sitzung, verwahrter Schlüssel, Hauptschlüssel, Rollenschlüssel,
 * Bereichsschlüssel, Chatschlüssel — und für eine Antwort dazu die
 * Unterschrift der Rolle. All das steht schon einmal da, geprüft, in
 * TypeScript (und gleich im Kernel, C#). Eine dritte Fassung in Java wäre die
 * Stelle, an der die Bytes auseinanderlaufen. Also lädt das Telefon dieselbe
 * Seite — {@code runner.html} aus den Dateien der App — ohne Bildschirm.</p>
 *
 * <p><b>Derselbe Ursprung wie die App</b> ({@code https://recreatio.pl}, aus
 * den Dateien der App bedient): dieselbe Sitzung (die Kekse gehören der App),
 * dieselbe Ablage, und der Dienst lässt ihn zu wie die App selbst. Die
 * Ablage des Geräts (Android Keystore) reicht {@link Bridge} herein — die
 * Brücke von Capacitor gibt es hier nicht.</p>
 *
 * <p><b>Nur eigene Dateien.</b> Die WebView navigiert nirgendwohin; was unter
 * recreatio.pl verlangt wird, kommt aus den Dateien der App, alles andere
 * (der Dienst) über das Netz. Nach einer halben Minute ohne Auftrag wird sie
 * weggeworfen — mit ihr die offenen Schlüssel im Speicher.</p>
 *
 * <p>{@link #run} wartet; nie auf dem Hauptfaden aufrufen.</p>
 */
final class RunnerHost {

    private static final String TAG = "recreatio";
    private static final String HOST = "recreatio.pl";
    private static final String PAGE = "https://" + HOST + "/runner.html";
    private static final long IDLE_MS = 30_000;

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final Map<String, CompletableFuture<String>> WAITING = new ConcurrentHashMap<>();

    /* Nur auf dem Hauptfaden. */
    private static WebView view;
    private static boolean ready;
    private static int generation;
    private static final List<String> QUEUED = new ArrayList<>();
    private static final Runnable IDLE = RunnerHost::destroy;

    private RunnerHost() {
    }

    /**
     * Einen Auftrag ausführen und auf die Antwort warten. Wirft bei
     * Zeitüberschreitung — dann wird die WebView weggeworfen, der nächste
     * Auftrag beginnt frisch.
     */
    static JSONObject run(Context context, JSONObject task, long timeoutMs) throws Exception {
        if (Looper.myLooper() == Looper.getMainLooper()) throw new IllegalStateException("RunnerHost.run on the main thread");

        String id = UUID.randomUUID().toString();
        task.put("id", id);
        String json = task.toString();
        Context app = context.getApplicationContext();

        CompletableFuture<String> result = new CompletableFuture<>();
        WAITING.put(id, result);
        MAIN.post(() -> dispatch(app, json));
        try {
            return new JSONObject(result.get(timeoutMs, TimeUnit.MILLISECONDS));
        } catch (TimeoutException e) {
            Log.w(TAG, "runner timed out (" + task.optString("kind") + ")");
            MAIN.post(RunnerHost::destroy);
            throw e;
        } finally {
            WAITING.remove(id);
        }
    }

    /** Beim Abmelden: keine Seite, keine offenen Schlüssel im Speicher. */
    static void shutdown() {
        MAIN.post(RunnerHost::destroy);
    }

    private static void dispatch(Context context, String json) {
        MAIN.removeCallbacks(IDLE);
        if (view == null) create(context);
        if (ready) send(json);
        else QUEUED.add(json);
    }

    private static void send(String json) {
        if (view == null) return;
        view.evaluateJavascript("window.__recreatioRunner && window.__recreatioRunner.run(" + JSONObject.quote(json) + ")", null);
    }

    @SuppressLint({ "SetJavaScriptEnabled", "AddJavascriptInterface" })
    private static void create(Context context) {
        generation += 1;
        ready = false;

        WebView web = new WebView(context);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setGeolocationEnabled(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        web.addJavascriptInterface(new Bridge(context, generation), "RecreatioRunner");
        web.setWebViewClient(new Client(context));
        web.loadUrl(PAGE);
        view = web;
    }

    private static void destroy() {
        MAIN.removeCallbacks(IDLE);
        if (view != null) {
            WebView gone = view;
            view = null;
            gone.removeJavascriptInterface("RecreatioRunner");
            gone.stopLoading();
            gone.destroy();
        }
        ready = false;
        QUEUED.clear();
        generation += 1;
    }

    /** Was die Seite des Läufers dem Telefon sagen darf — und die Ablage des Geräts. */
    private static final class Bridge {
        private final Context context;
        private final int mine;

        Bridge(Context context, int mine) {
            this.context = context;
            this.mine = mine;
        }

        @JavascriptInterface
        public String vaultGet(String slot) {
            return Vault.get(context, slot);
        }

        @JavascriptInterface
        public boolean vaultPut(String slot, String value) {
            try {
                Vault.put(context, slot, value);
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void vaultDrop(String slot) {
            Vault.drop(context, slot);
        }

        @JavascriptInterface
        public void ready() {
            MAIN.post(() -> {
                if (mine != generation || view == null) return;
                ready = true;
                for (String json : QUEUED) send(json);
                QUEUED.clear();
            });
        }

        @JavascriptInterface
        public void done(String id, String json) {
            CompletableFuture<String> waiting = WAITING.get(id);
            if (waiting != null) waiting.complete(json);
            MAIN.post(() -> {
                if (mine != generation) return;
                MAIN.removeCallbacks(IDLE);
                MAIN.postDelayed(IDLE, IDLE_MS);
            });
        }
    }

    private static final class Client extends WebViewClient {
        private final Context context;

        Client(Context context) {
            this.context = context;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            return true;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!"https".equals(url.getScheme()) || !HOST.equals(url.getHost())) return null;
            return asset(context, url.getPath());
        }

        /** Stirbt die Darstellung, stirbt nicht die App: die WebView geht, der nächste Auftrag beginnt neu. */
        @androidx.annotation.RequiresApi(26)
        @Override
        public boolean onRenderProcessGone(WebView gone, RenderProcessGoneDetail detail) {
            Log.w(TAG, "runner renderer gone");
            if (gone == RunnerHost.view) {
                RunnerHost.view = null;
                ready = false;
                QUEUED.clear();
                generation += 1;
            }
            gone.destroy();
            return true;
        }
    }

    /** Eine Datei der App unter {@code public/} — oder 404. */
    static WebResourceResponse asset(Context context, String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) path = "/runner.html";
        if (path.contains("..") || path.contains("\\")) return missing();
        try {
            InputStream in = context.getAssets().open("public" + path);
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse(mime(path), "UTF-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return missing();
        }
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    static String mime(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json") || lower.endsWith(".webmanifest")) return "application/json";
        if (lower.endsWith(".wasm")) return "application/wasm";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        return "application/octet-stream";
    }
}
