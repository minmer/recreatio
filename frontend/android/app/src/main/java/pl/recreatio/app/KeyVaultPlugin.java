package pl.recreatio.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.security.keystore.StrongBoxUnavailableException;
import android.util.Base64;

import androidx.annotation.RequiresApi;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * DER SCHLÜSSELSPEICHER DES GERÄTS (Kapitel 13.2) — was im Browser der
 * {@code localStorage} ist, liegt hier unter einem Schlüssel des Android
 * Keystore.
 *
 * <b>Was das ändert.</b> Die Werte liegen versiegelt in den Einstellungen der
 * App; der Schlüssel dazu liegt in der Hardware (StrongBox, wo es sie gibt,
 * sonst die TEE) und verlässt sie nie. Eine Abschrift der App-Daten allein
 * öffnet also nichts — auch nicht der Öffner aus {@code kept.ts}.
 *
 * <b>Die AAD ist der Name des Fachs.</b> Ein Wert, der in ein anderes Fach
 * kopiert wird, geht dort nicht mehr auf.
 *
 * <b>Unlesbar heisst: nie abgelegt.</b> Ist der Schlüssel fort (die App neu
 * installiert, der Speicher zurückgesetzt), wird das Fach geleert und
 * {@code null} gemeldet. Die Seite fragt dann nach dem Passwort — dieselbe
 * Antwort wie auf jeden anderen Grund, warum nichts verwahrt ist.
 */
@CapacitorPlugin(name = "KeyVault")
public class KeyVaultPlugin extends Plugin {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "recreatio.vault.v1";
    private static final String PREFS = "recreatio.vault.v1";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int TAG_BITS = 128;
    private static final int MAX_SLOT = 100;

    @PluginMethod
    public void get(PluginCall call) {
        String slot = call.getString("slot");
        if (!valid(slot)) {
            call.reject("Nieprawidłowa nazwa.");
            return;
        }

        JSObject result = new JSObject();
        String stored = prefs().getString(slot, null);
        if (stored != null) {
            try {
                result.put("value", open(slot, stored));
            } catch (GeneralSecurityException | IllegalArgumentException e) {
                prefs().edit().remove(slot).commit();
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void put(PluginCall call) {
        String slot = call.getString("slot");
        String value = call.getString("value");
        if (!valid(slot) || value == null) {
            call.reject("Nieprawidłowa wartość.");
            return;
        }

        try {
            if (!prefs().edit().putString(slot, seal(slot, value)).commit()) {
                call.reject("Nie udało się zapisać.");
                return;
            }
            call.resolve();
        } catch (GeneralSecurityException e) {
            call.reject("Magazyn kluczy tego urządzenia nie działa.", e);
        }
    }

    @PluginMethod
    public void drop(PluginCall call) {
        String slot = call.getString("slot");
        if (!valid(slot)) {
            call.reject("Nieprawidłowa nazwa.");
            return;
        }

        prefs().edit().remove(slot).commit();
        call.resolve();
    }

    private String seal(String slot, String value) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, key());
        cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
        byte[] sealed = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return encode(cipher.getIV()) + "." + encode(sealed);
    }

    private String open(String slot, String stored) throws GeneralSecurityException {
        int dot = stored.indexOf('.');
        if (dot <= 0) throw new IllegalArgumentException("form");

        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, decode(stored.substring(0, dot))));
        cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
        return new String(cipher.doFinal(decode(stored.substring(dot + 1))), StandardCharsets.UTF_8);
    }

    /** Der eine Schlüssel dieser App — vorhanden oder jetzt erzeugt. */
    private synchronized SecretKey key() throws GeneralSecurityException {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        try {
            store.load(null);
        } catch (IOException e) {
            throw new GeneralSecurityException(e);
        }

        if (store.containsAlias(ALIAS)) {
            return (SecretKey) store.getKey(ALIAS, null);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            && getContext().getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
            SecretKey strong = strongBox();
            if (strong != null) return strong;
        }

        return generate(false);
    }

    /** Im eigenen Sicherheitschip, wo es ihn gibt (Pixel: Titan M2). */
    @RequiresApi(Build.VERSION_CODES.P)
    private SecretKey strongBox() throws GeneralSecurityException {
        try {
            return generate(true);
        } catch (StrongBoxUnavailableException e) {
            return null;
        }
    }

    private static SecretKey generate(boolean strongBox) throws GeneralSecurityException {
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(
            ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256);

        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            spec.setIsStrongBoxBacked(true);
        }

        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(spec.build());
        return generator.generateKey();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static boolean valid(String slot) {
        return slot != null && !slot.isEmpty() && slot.length() <= MAX_SLOT;
    }

    private static String encode(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    private static byte[] decode(String text) {
        return Base64.decode(text, Base64.NO_WRAP);
    }
}
