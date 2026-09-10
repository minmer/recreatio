/*
    Die ersten Tabellen des Neubaus: ein Konto und eine Sitzung.

    =========================================================================
    WARUM EIN EIGENES SCHEMA UND KEIN PRAEFIX
    =========================================================================

    Der Altbestand liegt in `dbo` und `events`, der Parallelbau streute
    `rc_`-Praefixe ueber `dbo`. Beides zusammen macht `dbo` zu einer Schublade,
    in der man den Unterschied nur noch am Namen erkennt — und Namen sind das,
    was hier gerade neu gemacht wird.

    `app` ist ein SQL-Schema und kostet nichts. Es bringt drei Dinge, die ein
    Praefix nicht bringt:

      * Die Grenze ist im Werkzeug sichtbar, nicht in einer Namenskonvention.
      * Rechte lassen sich SCHEMAWEIT vergeben statt tabellenweise.
      * `DROP SCHEMA app` raeumt den Neubau vollstaendig weg — und genau das
        wird waehrend des Umbaus mehr als einmal gebraucht.

    Die Tabellennamen sind deshalb schlicht: `account`, nicht `app_account`.
    Das Schema sagt schon, wohin sie gehoeren.

    =========================================================================
    WAS DAS KONTO SPEICHERT — UND WAS ES NICHT KANN
    =========================================================================

    Kein Passwort. Nicht gehasht, nicht verschluesselt, gar nicht.

    Der Browser rechnet aus dem Passwort einen `PasswordKey` (Argon2id, 64 MiB)
    und schickt NUR den. Der Dienst leitet daraus mit einem zweiten Salz den
    `login_verifier` ab und vergleicht. Wer diese Tabelle vollstaendig besitzt,
    hat damit kein Passwort und keinen Schluessel:

      * `login_verifier` oeffnet nichts — er ist ein Vergleichswert.
      * `master_key_sealed` liegt unter dem `PasswordKey`, und der entsteht nur
        im Browser aus dem Passwort.

    Das ist 21.8, und der Kernel rechnet es (`RcPassword`, `RcAccountSecrets`).
    Diese Migration legt nur die Faecher an, in die das Ergebnis passt.

    =========================================================================
    WARUM DER HAUPTSCHLUESSEL ZUFAELLIG IST
    =========================================================================

    `master_key_sealed` enthaelt einen ZUFAELLIGEN Schluessel, nicht einen aus
    dem Passwort abgeleiteten. Der Unterschied zeigt sich beim Passwortwechsel:
    bei einem abgeleiteten muesste alles neu verschluesselt werden, was je
    darunter lag. Beim zufaelligen wird GENAU EINE Huelle neu versiegelt — der
    Rest bleibt, wie er ist.
*/

IF SCHEMA_ID('app') IS NULL
    EXEC('CREATE SCHEMA app');
GO

/*
    Was schon angewendet wurde.

    Mit Pruefsumme: ein bereits angewendetes Skript darf sich nicht mehr
    aendern. Wer es doch tut, faellt beim naechsten Lauf auf — statt dass zwei
    Datenbanken still auseinanderlaufen, weil eine die alte und eine die neue
    Fassung gesehen hat.
*/
IF OBJECT_ID('app.schema_version', 'U') IS NULL
BEGIN
    CREATE TABLE app.schema_version
    (
        name       nvarchar(200)  NOT NULL,
        checksum   char(64)       NOT NULL,
        applied_at datetimeoffset NOT NULL,

        CONSTRAINT pk_app_schema_version PRIMARY KEY (name)
    );
END
GO

IF OBJECT_ID('app.account', 'U') IS NULL
BEGIN
    CREATE TABLE app.account
    (
        id uniqueidentifier NOT NULL,

        /*
            Der Anmeldename. Klein geschrieben gespeichert, damit „Anna" und
            „anna" dasselbe Konto sind — sonst legt jemand versehentlich ein
            zweites an und wundert sich, wo seine Sachen sind.
        */
        login_id nvarchar(64) NOT NULL,

        /* Salz fuer Argon2id IM BROWSER. Es geht offen heraus: der Browser
           braucht es, bevor irgendjemand angemeldet ist. */
        password_salt varbinary(32) NOT NULL,

        /* Salz fuer die Ableitung des Vergleichswerts AUF DEM SERVER. Es
           verlaesst die Datenbank nie. */
        login_salt varbinary(32) NOT NULL,

        /* Der Vergleichswert. Oeffnet nichts. */
        login_verifier varbinary(64) NOT NULL,

        /* Der Hauptschluessel, versiegelt unter dem PasswordKey. */
        master_key_sealed varbinary(max) NOT NULL,

        created_at  datetimeoffset NOT NULL,

        /*
            Gesperrt statt geloescht. Ein geloeschtes Konto nimmt alles mit,
            was daran haengt; ein gesperrtes laesst sich zurueckholen, und die
            Kette bleibt lesbar.
        */
        disabled_at datetimeoffset NULL,

        CONSTRAINT pk_app_account PRIMARY KEY (id)
    );
END
GO

/* Ein Name, ein Konto. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_app_account_login')
BEGIN
    CREATE UNIQUE INDEX ux_app_account_login ON app.account (login_id);
END
GO

/*
    Die Sitzung.

    <b>Nur der SHA-256 des Geheimnisses.</b> Der Klartext steht genau einmal in
    der Antwort auf die Anmeldung und danach im Keks des Browsers — nie in der
    Datenbank. Ein Abzug dieser Tabelle erlaubt keinem, sich als jemand
    auszugeben; er sieht nur, DASS es Sitzungen gibt.

    Der Altbestand hatte sechs verschiedene Token-Verfahren nebeneinander, und
    eines davon legte den Klartext ab. Hier gibt es einen Weg, und er fuehrt
    ueber `RcToken` im Kernel.
*/
IF OBJECT_ID('app.session', 'U') IS NULL
BEGIN
    CREATE TABLE app.session
    (
        id           uniqueidentifier NOT NULL,
        account_id   uniqueidentifier NOT NULL,
        token_sha256 varbinary(32)    NOT NULL,

        created_at   datetimeoffset NOT NULL,
        expires_at   datetimeoffset NOT NULL,
        revoked_at   datetimeoffset NULL,

        CONSTRAINT pk_app_session PRIMARY KEY (id),
        CONSTRAINT fk_app_session_account
            FOREIGN KEY (account_id) REFERENCES app.account (id)
    );
END
GO

/*
    Nachschlagen geschieht ueber den Hash und sonst nichts — die Sitzungs-
    kennung steht nirgends im Keks. Ohne diesen Index ginge jede einzelne
    Anfrage durch alle Sitzungen.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_app_session_token')
BEGIN
    CREATE UNIQUE INDEX ux_app_session_token ON app.session (token_sha256);
END
GO
