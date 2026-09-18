/*
    Eine Nummer bestaetigen — ohne sie zu kennen.

    =========================================================================
    DER BEFUND
    =========================================================================

    „Ist diese Telefonnummer richtig?" beantwortet sonst der Dienst: er schickt
    eine SMS mit einem Code und vergleicht, was zurueckkommt. Hier kann er das
    nicht, und zwar grundsaetzlich — die Nummer liegt versiegelt unter dem
    Annahmeschluessel, und er hat ihn nie gesehen.

    Das ist kein Mangel, den man umgeht. Es ist die Bedingung, unter der diese
    Anwendung steht, und die Pruefung muss sich danach richten.

    =========================================================================
    WER WAS TUT
    =========================================================================

        Die Kanzlei   liest die Nummer (sie hat den Schluessel), wuerfelt ein
                      Geheimnis und verschickt den Link per SMS. Von Hand, mit
                      dem `sms:`-Knopf — dieselbe Nachricht wie sonst.

        Der Dienst    kennt nur den ABDRUCK des Geheimnisses und die Stelle,
                      um die es geht: welche Einsendung, welches Feld. Er weiss
                      nicht, welche Nummer das ist.

        Der Mensch    klickt. Damit steht fest, dass er unter dieser Nummer
                      erreichbar war — mehr beweist auch eine Code-SMS nicht.

    =========================================================================
    AN DER STELLE, NICHT AM MENSCHEN
    =========================================================================

    Bestaetigt wird ein WERT: diese Einsendung, dieses Feld. Nicht „Anna ist
    geprueft" — ein Bogen kann zwei Nummern tragen (Mutter und Vater), und die
    eine zu bestaetigen sagt nichts ueber die andere.

    Und deshalb faellt die Bestaetigung, wenn der Wert sich aendert: wer die
    Nummer berichtigt, hat eine ANDERE Nummer, und die ist ungeprueft. Das
    besorgt der Dienst beim Schreiben (`Form.ReviseAsOfficeAsync`) und nicht
    ein Mensch, der daran denken muesste.

    =========================================================================
    DAS GEHEIMNIS STEHT NICHT DA
    =========================================================================

    Nur sein SHA-256, wie bei jedem anderen hier. Wer die Datenbank liest, sieht,
    DASS eine Bestaetigung aussteht, und kann sie nicht ausloesen.
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'value_check')
BEGIN
    CREATE TABLE app.value_check
    (
        id              uniqueidentifier NOT NULL,

        /* WELCHER Wert — die Stelle, nicht der Inhalt. */
        registration_id uniqueidentifier NOT NULL,
        field_id        uniqueidentifier NOT NULL,

        token_sha256    varbinary(32) NOT NULL,

        /*
            Wann die Kanzlei ihn verschickt hat. Sie sagt es dem Dienst; er kann
            es nicht wissen, weil er die SMS nicht schickt.
        */
        sent_at         datetimeoffset(7) NOT NULL,

        /*
            Ein Bestaetigungslink lebt nicht ewig. Wer nach zwei Wochen darauf
            klickt, bestaetigt nichts mehr — bis dahin kann die Nummer laengst
            einem anderen gehoeren.
        */
        expires_at      datetimeoffset(7) NOT NULL,

        /* NULL heisst: noch nicht geklickt. Ein echter Zustand. */
        verified_at     datetimeoffset(7) NULL,

        CONSTRAINT pk_value_check PRIMARY KEY (id),
        CONSTRAINT fk_value_check_reg
            FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT fk_value_check_field
            FOREIGN KEY (field_id) REFERENCES app.slug_field (id)
    );
END
GO

/*
    Der Abdruck ist der Schluessel, unter dem nachgesehen wird — und zweimal
    derselbe waere zwei Bestaetigungen fuer ein Geheimnis.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_value_check_token')
    CREATE UNIQUE INDEX uq_value_check_token ON app.value_check (token_sha256);
GO

/* „Ist dieser Wert bestaetigt" — die Frage der Kanzlei bei jeder Liste. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_value_check_value')
    CREATE INDEX ix_value_check_value ON app.value_check (registration_id, field_id);
GO
