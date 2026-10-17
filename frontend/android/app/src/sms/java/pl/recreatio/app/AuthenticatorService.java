package pl.recreatio.app;

import android.accounts.AbstractAccountAuthenticator;
import android.accounts.Account;
import android.accounts.AccountAuthenticatorResponse;
import android.accounts.NetworkErrorException;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.IBinder;

/**
 * DAS KONTO „REcreatio" IM ADRESSBUCH — nur ein Name für die Kontakte, die
 * recreatio dort hineinschreibt ({@link PhoneContacts}). Ohne Passwort und ohne
 * Anmeldung: Android verlangt für ein eigenes Konto im Adressbuch diesen
 * Dienst, mehr tut er nicht.
 */
public class AuthenticatorService extends Service {

    private Authenticator authenticator;

    @Override
    public void onCreate() {
        super.onCreate();
        authenticator = new Authenticator(this);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return authenticator.getIBinder();
    }

    private static final class Authenticator extends AbstractAccountAuthenticator {
        Authenticator(Context context) {
            super(context);
        }

        @Override
        public Bundle editProperties(AccountAuthenticatorResponse response, String accountType) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Bundle addAccount(AccountAuthenticatorResponse response, String accountType, String authTokenType, String[] requiredFeatures, Bundle options) {
            /* Angelegt wird das Konto von der App selbst, nicht über die Einstellungen. */
            return null;
        }

        @Override
        public Bundle confirmCredentials(AccountAuthenticatorResponse response, Account account, Bundle options) {
            return null;
        }

        @Override
        public Bundle getAuthToken(AccountAuthenticatorResponse response, Account account, String authTokenType, Bundle options) throws NetworkErrorException {
            throw new UnsupportedOperationException();
        }

        @Override
        public String getAuthTokenLabel(String authTokenType) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Bundle updateCredentials(AccountAuthenticatorResponse response, Account account, String authTokenType, Bundle options) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Bundle hasFeatures(AccountAuthenticatorResponse response, Account account, String[] features) {
            Bundle result = new Bundle();
            result.putBoolean(android.accounts.AccountManager.KEY_BOOLEAN_RESULT, false);
            return result;
        }
    }
}
