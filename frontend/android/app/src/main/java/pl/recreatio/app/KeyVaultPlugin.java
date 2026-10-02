package pl.recreatio.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.GeneralSecurityException;

/**
 * DER SCHLÜSSELSPEICHER DES GERÄTS (Kapitel 13.2), für die Seite — was im
 * Browser der {@code localStorage} ist, liegt hier unter einem Schlüssel des
 * Android Keystore. Wie, steht in {@link Vault}; dort liest auch der Läufer im
 * Hintergrund (0076) dieselben Fächer.
 *
 * <b>Unlesbar heisst: nie abgelegt.</b> Ist der Schlüssel fort (die App neu
 * installiert, der Speicher zurückgesetzt), wird das Fach geleert und
 * {@code null} gemeldet. Die Seite fragt dann nach dem Passwort — dieselbe
 * Antwort wie auf jeden anderen Grund, warum nichts verwahrt ist.
 */
@CapacitorPlugin(name = "KeyVault")
public class KeyVaultPlugin extends Plugin {

    @PluginMethod
    public void get(PluginCall call) {
        String slot = call.getString("slot");
        if (!Vault.valid(slot)) {
            call.reject("Nieprawidłowa nazwa.");
            return;
        }

        JSObject result = new JSObject();
        String value = Vault.get(getContext(), slot);
        if (value != null) result.put("value", value);
        call.resolve(result);
    }

    @PluginMethod
    public void put(PluginCall call) {
        String slot = call.getString("slot");
        String value = call.getString("value");
        if (!Vault.valid(slot) || value == null) {
            call.reject("Nieprawidłowa wartość.");
            return;
        }

        try {
            Vault.put(getContext(), slot, value);
            call.resolve();
        } catch (GeneralSecurityException e) {
            call.reject("Magazyn kluczy tego urządzenia nie działa.", e);
        }
    }

    @PluginMethod
    public void drop(PluginCall call) {
        String slot = call.getString("slot");
        if (!Vault.valid(slot)) {
            call.reject("Nieprawidłowa nazwa.");
            return;
        }

        Vault.drop(getContext(), slot);
        call.resolve();
    }
}
