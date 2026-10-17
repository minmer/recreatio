package pl.recreatio.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import java.util.ArrayList;
import java.util.List;

/**
 * „NAPISZ SMS" AUS EINER ANDEREN APP (sms:, smsto:, mms:, Teilen als Text) — und
 * aus recreatio selbst, wenn eine Seite einen sms:-Link hat. Ohne Bildschirm:
 * die App öffnet sich beim Verfassen, Empfänger und Text stehen schon da
 * ({@code #/workspace/sms/nowa?do=…&tekst=…}).
 */
public class ComposeActivity extends Activity {

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Intent in = getIntent();
        List<String> to = recipients(in.getData());
        String body = in.getStringExtra("sms_body");
        if (body == null) body = in.getStringExtra(Intent.EXTRA_TEXT);
        if (body == null) body = query(in.getData(), "body");

        StringBuilder hash = new StringBuilder("#/workspace/sms/nowa");
        String sep = "?";
        if (!to.isEmpty()) {
            hash.append(sep).append("do=").append(Uri.encode(String.join(",", to)));
            sep = "&";
        }
        if (body != null && !body.isEmpty()) hash.append(sep).append("tekst=").append(Uri.encode(body));

        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("https://recreatio.pl/" + hash), this, MainActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(open);
        finish();
    }

    /** Die Empfänger aus „sms:+48600100200,601601601?body=…". */
    static List<String> recipients(Uri data) {
        List<String> out = new ArrayList<>();
        if (data == null) return out;
        String part = data.getEncodedSchemeSpecificPart();
        if (part == null) return out;
        int q = part.indexOf('?');
        if (q >= 0) part = part.substring(0, q);
        if (part.startsWith("//")) part = part.substring(2);
        for (String one : part.split("[,;]")) {
            String n = Uri.decode(one).trim();
            if (!n.isEmpty()) out.add(n);
        }
        return out;
    }

    private static String query(Uri data, String name) {
        if (data == null) return null;
        String part = data.getEncodedSchemeSpecificPart();
        if (part == null) return null;
        int q = part.indexOf('?');
        if (q < 0) return null;
        for (String pair : part.substring(q + 1).split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(name)) return Uri.decode(pair.substring(eq + 1));
        }
        return null;
    }
}
