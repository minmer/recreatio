/*
    Wer sich selbst anmeldet, bekommt einen Weg zurueck.

    =========================================================================
    DER BEFUND
    =========================================================================

    0023 hat es ausgeschrieben und gemeint:

        „NULL heisst: ohne Platz eingesandt. Dann liest ihn nur das Amt, und
        das ist richtig so — vom offenen Netz kommt niemand zurueck, der
        beweisen koennte, dass die Einsendung seine war."

    Der Satz stimmt fuer einen, der NICHTS hat. Er stimmt nicht mehr, sobald
    der Browser sich vor dem Absenden selbst einen Platz wuerfelt: dann hat er
    ein Geheimnis, und der Beweis ist derselbe wie bei jedem anderen Platz —
    wer den Link hat, ist gemeint.

    Ein Firmling fuellt das Formular aus und bekommt danach seine Adresse:

        recreatio.pl/parish/grzegorzki/confirmation/portal/<token>/<key>

    Nichts daran ist neu ausser dem Augenblick, in dem der Platz entsteht.
    Bisher stellte ihn das Amt aus und verschickte ihn; jetzt entsteht er
    zugleich mit der Einsendung, im Browser dessen, den er meint.

    =========================================================================
    WARUM DER EPOCHENSCHLUESSEL HIER NICHT TAUGT
    =========================================================================

    Ein Platz traegt seinen Schluessel zweimal (0023): unter dem Link, damit
    der Mensch herankommt, und unter dem EPOCHENSCHLUESSEL des Bereichs, damit
    die Kanzlei herankommt.

    Fuer eine Selbstanmeldung geht der zweite Weg nicht — und zwar aus zwei
    Gruenden, von denen der zweite der ernstere ist:

        1. Der Fremde HAT den Epochenschluessel nicht. Er koennte gar nicht
           unter ihm versiegeln.

        2. Und wo er ihn hat, ist er nichts mehr wert. Ein oeffentliches
           Formular geht nur auf, wenn der Bereich seinen Epochenschluessel
           VEROEFFENTLICHT hat (`GET /area/{id}/key`) — sonst bleiben die
           Beschriftungen zu und niemand sieht, wonach gefragt wird. Unter
           einem veroeffentlichten Schluessel zu versiegeln schuetzt nichts:
           er ist per Absicht kein Geheimnis.

    Der Platz einer Selbstanmeldung wird deshalb unter dem ANNAHMESCHLUESSEL
    verpackt — der oeffentlichen Haelfte des RSA-Paars, das ohnehin schon auf
    dem Formular steht. Seine private Haelfte liegt unter dem AMTSSCHLUESSEL
    und nicht unter einer Epoche (0005, Intake.cs): Mitgliedschaft ist keine
    Befugnis. Damit liest die Kanzlei den Platz und sonst niemand — auch dann
    nicht, wenn der Epochenschluessel offen im Netz steht.

    =========================================================================
    ZWEI WEGE FUER DIE KANZLEI, GENAU EINER JE PLATZ
    =========================================================================

        seat_key_for_area     ausgestellt vom Amt      — unter der Epoche
        seat_key_for_intake   selbst angemeldet        — unter der Annahme

    Keiner von beiden darf fehlen: ein Platz, den die Kanzlei nicht oeffnen
    kann, ist eine Zeile, die niemandem gehoert. Die Bedingung steht deshalb
    als CHECK und nicht in einer Pruefung im Dienst, die man beim naechsten
    Umbau vergisst.
*/

/* -------------------------------------------------------------------------
   1. Der zweite Weg der Kanzlei
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.access', 'seat_key_for_intake') IS NULL
    ALTER TABLE app.access ADD seat_key_for_intake varbinary(max) NULL;
GO

/*
    `seat_key_for_area` war seit 0023 verpflichtend. Das war richtig, solange
    das Amt der einzige Aussteller war; jetzt gibt es einen zweiten Fall, und
    fuer den ist die Spalte leer.
*/
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.access')
             AND name = 'seat_key_for_area' AND is_nullable = 0)
    ALTER TABLE app.access ALTER COLUMN seat_key_for_area varbinary(max) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_access_office_way_in')
    ALTER TABLE app.access ADD CONSTRAINT ck_access_office_way_in
        CHECK (seat_key_for_area IS NOT NULL OR seat_key_for_intake IS NOT NULL);
GO

/* -------------------------------------------------------------------------
   2. Woher der Platz kommt

   Nicht abzuleiten aus „welche Spalte ist gefuellt": das waere dieselbe
   Auskunft, aber als Schluss statt als Angabe — und der naechste, der eine
   dritte Art Platz baut, muesste den Schluss mitpflegen.

   `office`  das Amt hat ihn ausgestellt und verschickt
   `self`    er ist mit einer Einsendung entstanden
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.access', 'origin') IS NULL
    ALTER TABLE app.access ADD origin nvarchar(20) NOT NULL
        CONSTRAINT df_access_origin DEFAULT N'office';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_access_origin')
    ALTER TABLE app.access ADD CONSTRAINT ck_access_origin
        CHECK (origin IN (N'office', N'self'));
GO

/* -------------------------------------------------------------------------
   3. „Zeig mir meine eigene Einsendung"

   Der Platz fragt nach dem, was UNTER IHM eingesandt wurde. Ohne diesen
   Index waere das ein Durchgang durch alle Einsendungen aller Formulare,
   jedesmal, wenn jemand sein Portal oeffnet.
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_access')
    CREATE INDEX ix_registration_access ON app.registration (access_id)
        WHERE access_id IS NOT NULL;
GO
