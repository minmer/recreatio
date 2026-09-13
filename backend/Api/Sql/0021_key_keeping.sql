/*
    Der PasswordKey darf ueberleben — aber nicht fuer den Dienst.

    =========================================================================
    1. WORUM ES GEHT
    =========================================================================

    Bisher lebte der PasswordKey ausschliesslich im Arbeitsspeicher des Tabs.
    Das ist die sicherste Fassung und zugleich die unbequemste: nach jedem
    Neuladen steht der Mensch vor einem Passwortfeld, obwohl er angemeldet ist.

    Ab hier gibt es zwei Betriebsarten, und die Zeile sagt, welche gilt:

        kept  — der Schluessel ueberlebt (Vorgabe)
        tab   — der Schluessel lebt nur im Tab, wie bisher

    =========================================================================
    2. WARUM DER DIENST IHN TROTZDEM NICHT LESEN KANN
    =========================================================================

    `sealed_blob` ist der PasswordKey, VERSIEGELT unter einem Zufallsschluessel,
    den allein der Browser haelt (`localStorage`, je Geraet einer). Der Dienst
    bekommt die Huelle und niemals den Oeffner.

        Datenbank allein   -> Huellen ohne Schluessel. Nichts.
        Geraet allein      -> Schluessel ohne Huelle; die Huelle gibt es nur
                              gegen eine gueltige Sitzung. Nichts.
        beides zusammen    -> alles.

    Der Altbestand schickte den PasswordKey offen an den Server und liess dort
    entschluesseln. Genau das ist hier NICHT wiederhergestellt: was hier liegt,
    ist fuer den Betreiber Rauschen. Wer das nachpruefen will, sucht im Dienst
    nach einer Stelle, die `sealed_blob` oeffnet — es gibt keine.

    =========================================================================
    3. WARUM JE GERAET EINE ZEILE
    =========================================================================

    Der Oeffner liegt im `localStorage` EINES Browsers. Ein zweiter Browser hat
    einen anderen, und derselbe Blob ginge dort nicht auf. Eine Zeile je Geraet
    ist deshalb keine Bequemlichkeit, sondern die Bedingung dafuer, dass es
    ueberhaupt funktioniert — und sie erlaubt nebenbei, ein einzelnes Geraet zu
    vergessen, ohne die uebrigen auszusperren.

    =========================================================================
    4. WARUM DIE VORGABE `kept` IST
    =========================================================================

    Weil die strengere Fassung sonst niemand erlebt: wer bei jedem Neuladen
    sein Passwort tippt, schaltet nach einer Woche irgendetwas ab — und was
    dann abgeschaltet wird, ist selten das Richtige. Die strenge Fassung bleibt
    einen Schalter entfernt und nimmt beim Umschalten die Huellen mit.
*/

/* -------------------------------------------------------------------------
   1. Die Betriebsart steht am Konto
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.account', 'key_keeping') IS NULL
    ALTER TABLE app.account ADD key_keeping nvarchar(16) NOT NULL
        CONSTRAINT df_account_key_keeping DEFAULT (N'kept');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_account_key_keeping')
    ALTER TABLE app.account ADD CONSTRAINT ck_account_key_keeping
        CHECK (key_keeping IN (N'kept', N'tab'));
GO

/* -------------------------------------------------------------------------
   2. Die Huelle — je Konto und Geraet eine
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.account_key', 'U') IS NULL
BEGIN
    CREATE TABLE app.account_key
    (
        account_id   uniqueidentifier NOT NULL,

        /*
            WELCHES Geraet. Die Kennung entsteht im Browser und steht neben dem
            Oeffner im `localStorage`. Sie ist kein Geheimnis: sie sagt nur,
            welche der Huellen zu holen ist.
        */
        device_id    uniqueidentifier NOT NULL,

        /*
            Der PasswordKey, versiegelt unter dem Geraeteschluessel.

            Klein und fester Groesse — ein versiegelter 32-Byte-Schluessel sind
            achtzig Byte. `varbinary(max)` waere ein Versprechen, das diese
            Spalte nicht einloesen soll; die Grenze steht deshalb auch im
            Dienst, und dort mit einer Meldung.
        */
        sealed_blob  varbinary(512) NOT NULL,

        created_at   datetimeoffset NOT NULL,

        /*
            Wann zuletzt geholt. Nicht fuer die Abrechnung, sondern damit ein
            Mensch in seinen Einstellungen sieht, welche Geraete noch mitlesen
            koennten — ein Geraet, das seit einem Jahr nicht gefragt hat, ist
            meist eines, das man nicht mehr besitzt.
        */
        last_used_at datetimeoffset NULL,

        CONSTRAINT pk_account_key PRIMARY KEY (account_id, device_id),

        CONSTRAINT fk_account_key_account
            FOREIGN KEY (account_id) REFERENCES app.account (id),

        CONSTRAINT ck_account_key_size CHECK (DATALENGTH(sealed_blob) BETWEEN 20 AND 512)
    );
END
GO

/* „Was liegt fuer dieses Konto" — die Frage der Einstellungen. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_account_key_account')
    CREATE INDEX ix_account_key_account ON app.account_key (account_id, last_used_at DESC);
GO
