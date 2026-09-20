/*
    Zwei Wege zu derselben Bestaetigung — und sie beweisen NICHT dasselbe.

    =========================================================================
    DER BEFUND
    =========================================================================

    0030 kennt einen Weg: die Kanzlei verschickt einen Link per SMS, der Mensch
    tippt darauf, und damit steht fest, dass er unter DIESER Nummer erreichbar
    war. Das ist der Beweis, um den es geht.

    Es gibt aber einen zweiten Handgriff, der sich gehoert: im eigenen Portal
    auf „to moj numer" zu druecken. Der ist nuetzlich — er sagt, dass die
    Angabe noch stimmt und nicht aus einem alten Bogen stammt — und er beweist
    etwas ANDERES. Wer im Portal sitzt, hat den Portallink; ob das Telefon
    klingelt, sagt das nicht.

    =========================================================================
    WARUM DAS IN DER ZEILE STEHEN MUSS
    =========================================================================

    Weil die Kanzlei sonst belogen wird. In der Liste steht heute

        „ta osoba kliknela link, ktory tam wyslaliscie"

    und das waere schlicht falsch, sobald jemand im Portal gedrueckt hat.
    Zwei verschiedene Auskuenfte duerfen nicht als dieselbe erscheinen; wer sie
    zusammenwirft, spart eine Spalte und verliert den Unterschied, der den
    ganzen Vorgang ausmacht.

    =========================================================================
    UND DESHALB HAT EINE SELBSTBESTAETIGUNG KEINEN ABDRUCK
    =========================================================================

    `token_sha256` ist der Abdruck eines verschickten Geheimnisses. Bei einer
    Selbstbestaetigung wurde nichts verschickt, also steht dort NULL — und
    nicht etwa ein gewuerfelter Wert, der so tut, als gaebe es einen Link.
    Der Index wird dafuer gefiltert; die Regel darunter haelt beide Wege
    auseinander.
*/

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.value_check') AND name = 'origin')
BEGIN
    ALTER TABLE app.value_check
        ADD origin varchar(8) NOT NULL
            CONSTRAINT df_value_check_origin DEFAULT 'sms';
END
GO

/* Ein Link, der nie verschickt wurde, hat keinen Abdruck. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.value_check')
             AND name = 'token_sha256' AND is_nullable = 0)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_value_check_token'
                 AND object_id = OBJECT_ID('app.value_check'))
        DROP INDEX uq_value_check_token ON app.value_check;

    ALTER TABLE app.value_check ALTER COLUMN token_sha256 varbinary(32) NULL;
END
GO

/*
    Gefiltert: zweimal derselbe Abdruck bleibt verboten, aber viele
    Selbstbestaetigungen ohne Abdruck sind kein Widerspruch. Ein ungefilterter
    UNIQUE-Index liesse in SQL Server genau EIN NULL zu — die zweite
    Selbstbestaetigung ueberhaupt waere daran gescheitert.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_value_check_token'
                 AND object_id = OBJECT_ID('app.value_check'))
    CREATE UNIQUE INDEX uq_value_check_token ON app.value_check (token_sha256)
        WHERE token_sha256 IS NOT NULL;
GO

/*
    DER WEG BESTIMMT, WAS DASTEHEN MUSS.

        sms   ein Abdruck ist da; ob schon geklickt wurde, steht offen.
        self  kein Abdruck, und bestaetigt ist sie im selben Augenblick —
              eine „offene" Selbstbestaetigung waere ein Zustand, auf den
              niemand wartet.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_value_check_way')
    ALTER TABLE app.value_check ADD CONSTRAINT ck_value_check_way CHECK
    (
        (origin = 'sms'  AND token_sha256 IS NOT NULL)
        OR
        (origin = 'self' AND token_sha256 IS NULL AND verified_at IS NOT NULL)
    );
GO
