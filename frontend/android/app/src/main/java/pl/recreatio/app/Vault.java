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

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * DER SCHLÜSSELSPEICHER DES GERÄTS — was im Browser der {@code localStorage}
 * ist, liegt hier unter einem Schlüssel des Android Keystore.
 *
 * <p>Zwei Türen führen herein: die Seite über {@link KeyVaultPlugin} und
 * (0076) der Läufer im Hintergrund über {@link RunnerHost}. Beide lesen
 * dieselben Fächer mit demselben Schlüssel — deshalb steht er hier und nicht
 * im Plugin.</p>
 *
 * <p><b>Was das ändert.</b> Die Werte liegen versiegelt in den Einstellungen
 * der App; der Schlüssel dazu liegt in der Hardware (StrongBox, wo es sie gibt,
 * sonst die TEE) und verlässt sie nie. Eine Abschrift der App-Daten allein
 * öffnet also nichts — auch nicht der Öffner aus {@code kept.ts}.</p>
 *
 * <p><b>Die AAD ist der Name des Fachs.</b> Ein Wert, der in ein anderes Fach
 * kopiert wird, geht dort nicht mehr auf.</p>
 *
 * <p><b>Unlesbar heisst: nie abgelegt.</b> Ist der Schlüssel fort (die App neu
 * installiert, der Speicher zurückgesetzt), wird das Fach geleert und
 * {@code null} gemeldet.</p>
 */
final class Vault {

    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String ALIAS = "recreatio.vault.v1";
    private static final String PREFS = "recreatio.vault.v1";
    private static final String CIPHER = "AES/GCM/NoPadding";
    private static final int TAG_BITS = 128;
    private static final int MAX_SLOT = 100;

    private Vault() {
    }

    static boolean valid(String slot) {
        return slot != null && !slot.isEmpty() && slot.length() <= MAX_SLOT;
    }

    /** Der Wert eines Fachs — {@code null}, wenn nichts (Lesbares) darin liegt. */
    static String get(Context context, String slot) {
        if (!valid(slot)) return null;
        String stored = prefs(context).getString(slot, null);
        if (stored == null) return null;
        try {
            return open(slot, stored);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            prefs(context).edit().remove(slot).commit();
            return null;
        }
    }

    static void put(Context context, String slot, String value) throws GeneralSecurityException {
        if (!valid(slot) || value == null) throw new IllegalArgumentException("slot");
        if (!prefs(context).edit().putString(slot, seal(context, slot, value)).commit()) {
            throw new GeneralSecurityException("not written");
        }
    }

    static void drop(Context context, String slot) {
        if (!valid(slot)) return;
        prefs(context).edit().remove(slot).commit();
    }

    private static String seal(Context context, String slot, String value) throws GeneralSecurityException {
        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.ENCRYPT_MODE, key(context));
        cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
        byte[] sealed = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return encode(cipher.getIV()) + "." + encode(sealed);
    }

    private static String open(String slot, String stored) throws GeneralSecurityException {
        int dot = stored.indexOf('.');
        if (dot <= 0) throw new IllegalArgumentException("form");

        Cipher cipher = Cipher.getInstance(CIPHER);
        cipher.init(Cipher.DECRYPT_MODE, existingKey(), new GCMParameterSpec(TAG_BITS, decode(stored.substring(0, dot))));
        cipher.updateAAD(slot.getBytes(StandardCharsets.UTF_8));
        return new String(cipher.doFinal(decode(stored.substring(dot + 1))), StandardCharsets.UTF_8);
    }

    private static KeyStore store() throws GeneralSecurityException {
        KeyStore store = KeyStore.getInstance(KEYSTORE);
        try {
            store.load(null);
        } catch (IOException e) {
            throw new GeneralSecurityException(e);
        }
        return store;
    }

    /** Zum Öffnen: nur ein Schlüssel, der schon da ist — ein neuer öffnete ohnehin nichts. */
    private static SecretKey existingKey() throws GeneralSecurityException {
        KeyStore store = store();
        if (!store.containsAlias(ALIAS)) throw new GeneralSecurityException("no key");
        return (SecretKey) store.getKey(ALIAS, null);
    }

    /** Der eine Schlüssel dieser App — vorhanden oder jetzt erzeugt. */
    private static synchronized SecretKey key(Context context) throws GeneralSecurityException {
        KeyStore store = store();
        if (store.containsAlias(ALIAS)) {
            return (SecretKey) store.getKey(ALIAS, null);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            && context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)) {
            SecretKey strong = strongBox();
            if (strong != null) return strong;
        }

        return generate(false);
    }

    /** Im eigenen Sicherheitschip, wo es ihn gibt (Pixel: Titan M2). */
    @RequiresApi(Build.VERSION_CODES.P)
    private static SecretKey strongBox() throws GeneralSecurityException {
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

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static String encode(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    private static byte[] decode(String text) {
        return Base64.decode(text, Base64.NO_WRAP);
    }
}
