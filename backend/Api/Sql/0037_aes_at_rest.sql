/*
    RSA ist der Umschlag, nicht der Tresor.

    =========================================================================
    DER BEFUND
    =========================================================================

    Die Inhalte liegen laengst unter AES-256-GCM. RSA verschluesselt hier nie
    eine Nutzlast — es verpackt den 32-Byte-Schluessel FUER JEMANDEN, dessen
    Geheimnis man nicht hat. Das ist genau das, wofuer RSA taugt.

    Nur bleiben diese Umschlaege dann LIEGEN. Und die oeffentlichen Haelften
    stehen im Klartext in derselben Datenbank:

        registration_value.wrapped_key    -> intake.public_key
        access.seat_key_for_intake        -> intake.public_key
        key_grant.sealed_blob             -> role.wrap_public_key

    Wer einen Abzug hat, greift damit nicht 336 Umschlaege an. Er faktorisiert
    EINEN Modulus — und haelt danach jede Einsendung des Bereichs. Ein einziger
    Punkt, an dem alles haengt, und er liegt offen daneben.

    AES-256 hat diese Angriffsflaeche nicht: es gibt keine oeffentliche
    Haelfte. Grover halbiert die Staerke auf 128 Bit, und das genuegt.

    =========================================================================
    WAS SICH AENDERT
    =========================================================================

    RSA bleibt — fuer die UEBERGABE. Es hoert auf, das zu sein, was jahrelang
    liegenbleibt.

        Beim Anlegen      RSA-OAEP an den Empfaenger, wie bisher.
        Beim ERSTEN Oeffnen  wer ihn aufmacht, versiegelt den Schluessel neu
                          unter einem SYMMETRISCHEN Schluessel, den nur er hat.
        Danach            der RSA-Umschlag faellt.

    Aus „RSA schuetzt das bis in zehn Jahre" wird „RSA schuetzt das bis zum
    naechsten Login".

    =========================================================================
    UNTER WELCHEM SCHLUESSEL — UND WARUM NICHT UNTER DER EPOCHE
    =========================================================================

    Die Werte einer Einsendung werden NICHT unter dem Epochenschluessel neu
    versiegelt, sondern unter dem Schluessel der AMTSROLLE.

    0005 nennt den Grund und er gilt unveraendert: laege die Annahme unter der
    Epoche, koennte jeder Helfer saemtliche Anmeldungen lesen, ohne dass ihm
    jemand etwas gegeben haette. Es folgte aus der Mitgliedschaft — und
    Mitgliedschaft ist keine Befugnis. Der Umbau darf diese Trennung nicht
    nebenbei aufheben.

    =========================================================================
    WAS ER NICHT KANN
    =========================================================================

    <b>Einen Abzug von gestern rettet er nicht.</b> Wer heute kopiert und
    wartet, bis RSA faellt, hat den Umschlag in seiner Kopie. Das ist nicht zu
    heilen, und es waere unredlich, den Umbau so darzustellen, als waere es
    das.

    <b>Und ein PQ-KEM waere das Eigentliche.</b> ML-KEM (FIPS 203) fuer die
    Uebergabe selbst — WebCrypto kennt es noch nicht, und eine WASM-Abhaengigkeit
    mitten im Versiegelungsweg ist eine eigene Entscheidung. Dieser Umbau ist
    damit vertraeglich: er verkleinert das Fenster, in dem RSA ueberhaupt
    etwas schuetzt.
*/

/* -- Die Werte einer Einsendung ------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.registration_value') AND name = 'office_key_sealed')
BEGIN
    ALTER TABLE app.registration_value ADD office_key_sealed varbinary(max) NULL;
END
GO

/*
    `wrapped_key` darf jetzt fehlen — aber nicht zugleich mit dem neuen. Sonst
    stuende ein Wert da, den das Amt auf keinem Weg mehr oeffnet.
*/
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.registration_value')
             AND name = 'wrapped_key' AND is_nullable = 0)
    ALTER TABLE app.registration_value ALTER COLUMN wrapped_key varbinary(max) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_registration_value_office')
    ALTER TABLE app.registration_value ADD CONSTRAINT ck_registration_value_office
        CHECK (wrapped_key IS NOT NULL OR office_key_sealed IS NOT NULL);
GO

/* -- Der Platz einer Selbstanmeldung -------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.access') AND name = 'seat_key_for_office')
BEGIN
    ALTER TABLE app.access ADD seat_key_for_office varbinary(max) NULL;
END
GO

/*
    Die Regel von 0027 bekommt den dritten Weg dazu: ein Platz muss dem Amt auf
    IRGENDEINEM Weg offenstehen — ueber die Epoche, ueber die Annahme, oder
    (neu) unter dem Schluessel der Amtsrolle.
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_access_office_way_in')
    ALTER TABLE app.access DROP CONSTRAINT ck_access_office_way_in;
GO

ALTER TABLE app.access ADD CONSTRAINT ck_access_office_way_in
    CHECK (seat_key_for_area IS NOT NULL
        OR seat_key_for_intake IS NOT NULL
        OR seat_key_for_office IS NOT NULL);
GO

/* -- Die Zuteilungen ------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.key_grant') AND name = 'sealed_held')
BEGIN
    ALTER TABLE app.key_grant ADD sealed_held varbinary(max) NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.key_grant')
             AND name = 'sealed_blob' AND is_nullable = 0)
    ALTER TABLE app.key_grant ALTER COLUMN sealed_blob varbinary(max) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_key_grant_one_way')
    ALTER TABLE app.key_grant ADD CONSTRAINT ck_key_grant_one_way
        CHECK (sealed_blob IS NOT NULL OR sealed_held IS NOT NULL);
GO

/*
    „Was ist noch nicht umgestellt" — die Frage, die der Umbau selbst stellt,
    und die Kanzlei sehen koennen soll.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_value_rsa')
    CREATE INDEX ix_registration_value_rsa
        ON app.registration_value (registration_id)
        WHERE wrapped_key IS NOT NULL;
GO
