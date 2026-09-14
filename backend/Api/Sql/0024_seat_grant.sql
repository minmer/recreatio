/*
    Was ein Platz AUSSER seinem eigenen Inhalt noch aufschliesst.

    =========================================================================
    DIE VIER TEILE EINER KLASSE
    =========================================================================

    Ein Schuelerportal traegt vier Dinge, und jedes gehoert jemand anderem:

        1. was der Schueler SELBST hat      sein Rollenschluessel
        2. was er der Schule GIBT           der Annahmeschluessel des Amtes
        3. was der Lehrer ueber ihn notiert der Epochenschluessel des Amtes
        4. was der ganzen Klasse gilt       der Epochenschluessel der KLASSE

    Dazu, schon gebaut, das Fuenfte: was der Lehrer DIESEM Schueler schreibt —
    unter dem Platzschluessel.

    <b>Deshalb hat eine Klasse ZWEI Bereiche und nicht einen.</b> Laege das
    Gemeinsame unter demselben Schluessel wie die Notizen, oeffnete jeder
    Schueler mit dem Gemeinsamen auch die Notizen — und die Anmeldungen aller
    anderen dazu. Die Trennung ist erzwungen, nicht Geschmack:

        Klasse       das Gemeinsame. Jeder Platz traegt diesen Schluessel.
        Kanzlei      Notizen und Eingesandtes. Nur das Amt.

    =========================================================================
    WARUM EINE EIGENE TABELLE UND NICHT `key_grant`
    =========================================================================

    `app.key_grant` kann das seit 0001 — die Art `shared_view` steht dort schon
    in der Prueflliste. Aber sie haengt an einer ROLLE, und ein Vierzehnjaehriger
    mit einem Link hat keine. Eine Rolle je Schueler anzulegen kostete zwei
    RSA-4096-Paare; bei dreissig Schuelern sind das Minuten, und unterschreiben
    wuerde keine davon je.

    Also dasselbe eine Ebene tiefer: an den PLATZ gehaengt und unter dem
    PLATZSCHLUESSEL versiegelt. Damit laeuft alles ueber einen einzigen Weg —

        Link ──► Platzschluessel ──► diese Zuteilung ──► Klassenschluessel

    — und wer seinen Platz spaeter an ein Konto bindet, bekommt den
    Platzschluessel unter seiner Rolle und erreicht dasselbe ohne den Link. Ein
    zweiter Mechanismus fuer denselben Zweck waere eine zweite Gelegenheit, ihn
    falsch zu bauen.

    =========================================================================
    WAS DAS GEMEINSAME IST
    =========================================================================

    Nichts Neues: der Kalender der Klasse (Stundenplan, Termine) und ihre
    Nachrichten liegen ohnehin an einem Bereich und sind ohnehin je Bereich
    versiegelt. Diese Zeile sagt nur, WER den Schluessel dazu hat.
*/

IF OBJECT_ID('app.access_grant', 'U') IS NULL
BEGIN
    CREATE TABLE app.access_grant
    (
        access_id   uniqueidentifier NOT NULL,

        /* WELCHER Bereich aufgeschlossen wird — nicht der des Platzes selbst. */
        area_id     uniqueidentifier NOT NULL,
        epoch       int              NOT NULL,

        /*
            Der Epochenschluessel jenes Bereichs, versiegelt unter dem
            PLATZSCHLUESSEL. Der Dienst legt ihn ab und kann ihn nicht oeffnen —
            den Platzschluessel hat er nie gesehen.
        */
        sealed_blob varbinary(max)   NOT NULL,

        created_at  datetimeoffset   NOT NULL,

        CONSTRAINT pk_access_grant PRIMARY KEY (access_id, area_id),

        CONSTRAINT fk_access_grant_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_access_grant_area   FOREIGN KEY (area_id)   REFERENCES app.area (id),

        CONSTRAINT ck_access_grant_epoch CHECK (epoch >= 1)
    );
END
GO

/* „Welche Plaetze halten den Schluessel dieses Bereichs" — die Frage beim Schnitt. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_grant_area')
    CREATE INDEX ix_access_grant_area ON app.access_grant (area_id, epoch);
GO
