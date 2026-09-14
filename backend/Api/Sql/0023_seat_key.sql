/*
    Der Platz bekommt einen EIGENEN Schluessel.

    =========================================================================
    DER BEFUND
    =========================================================================

    0005 nannte die Spalte `epoch_key_sealed` und meinte es woertlich: der Link
    trug den EPOCHENSCHLUESSEL DES BEREICHS. Fuer einen einzelnen Aushang geht
    das auf. Fuer das, was jetzt gebaut wird, nicht:

        Ein Lehrer legt fuer jeden Schueler einen Platz an und schreibt auf
        jeden etwas anderes. Traegt jeder Link den Epochenschluessel, oeffnet
        JEDER Schueler JEDEN anderen Platz — und alles uebrige, was je unter
        dieser Epoche versiegelt wurde.

    Das ist kein Fehler in der Umsetzung, den man spaeter findet; es ist die
    Bedeutung der Spalte. Deshalb aendert sie sich hier, bevor darauf gebaut
    wird.

    =========================================================================
    DIE FORM
    =========================================================================

    Jeder Platz hat seinen eigenen Schluessel, und der wird ZWEIMAL verpackt:

        seat_key_sealed     unter dem Schluessel AUS DEM LINK
                            -> der Mensch auf dem Platz kommt heran

        seat_key_for_area   unter dem Epochenschluessel des Bereichs
                            -> die Kanzlei kommt heran, auch spaeter und auch
                               als jemand anderes als der Aussteller

    Damit teilt sich, was sich teilen muss:

        personal_note_sealed   unter dem PLATZSCHLUESSEL  — beide lesen es
        internal_note_sealed   unter dem EPOCHENSCHLUESSEL — nur die Kanzlei

    Ein Platzinhaber kann den zweiten nicht oeffnen, und ein Platzinhaber kann
    den Platz seines Nachbarn nicht oeffnen. Beides folgt aus den Schluesseln
    und nicht aus einer Bedingung, die jemand richtig schreiben muss.

    =========================================================================
    ZWEI GEHEIMNISSE IM LINK, NICHT EINES
    =========================================================================

    Der Link traegt `token` UND `key`, und sie tun Verschiedenes:

        token   geht an den Dienst und sagt, WELCHER Platz gemeint ist.
                Gespeichert wird nur sein SHA-256.

        key     geht NIE an den Dienst. Er oeffnet `seat_key_sealed`.

    Eines davon abzuleiten waere kuerzer und falsch: der Dienst bekaeme das
    Ableitungsgeheimnis zu sehen und koennte den Platz selbst oeffnen.

    =========================================================================
    UND DIE EIGENE EINSENDUNG
    =========================================================================

    Was jemand ueber einen Platz eingesandt hat, soll er wiederlesen koennen.
    Der Annahmeschluessel taugt dafuer nicht — er gehoert dem Amt. Also liegt
    der Wertschluessel ein zweites Mal da, versiegelt unter dem Platzschluessel:
    `registration_value.seat_key_sealed`.

    NULL heisst: ohne Platz eingesandt. Dann liest ihn nur das Amt, und das ist
    richtig so — vom offenen Netz kommt niemand zurueck, der beweisen koennte,
    dass die Einsendung seine war.
*/

/* -------------------------------------------------------------------------
   1. Der Platzschluessel
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.access', 'epoch_key_sealed') IS NOT NULL
    EXEC sp_rename 'app.access.epoch_key_sealed', 'seat_key_sealed', 'COLUMN';
GO

IF COL_LENGTH('app.access', 'seat_key_for_area') IS NULL
    ALTER TABLE app.access ADD seat_key_for_area varbinary(max) NULL;
GO

/*
    NULL waere ein Platz, an den die Kanzlei nicht mehr herankommt. Die Tabelle
    ist leer, also wird die Spalte gleich verpflichtend — bei einer vollen
    stuende hier ein Umzug.
*/
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.access')
             AND name = 'seat_key_for_area' AND is_nullable = 1)
    ALTER TABLE app.access ALTER COLUMN seat_key_for_area varbinary(max) NOT NULL;
GO

/* -------------------------------------------------------------------------
   2. Wer den Platz haelt, kommt auch OHNE den Link heran

   Sonst waere das Binden an ein Konto eine Eintragung ohne Wirkung: der
   Platzschluessel laege unter dem Link und unter der Epoche, und ein Halter
   hat weder das eine noch das andere. Er saehe seinen Platz in der Liste und
   bekaeme ihn nicht auf.

   Verpackt unter dem OEFFENTLICHEN Schluessel seiner Rolle — derselbe Weg wie
   `app.key_grant`, und aus demselben Grund: wer bindet, braucht dafuer kein
   Geheimnis des Gebundenen.
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.access_holder', 'seat_key_sealed') IS NULL
    ALTER TABLE app.access_holder ADD seat_key_sealed varbinary(max) NULL;
GO

/* -------------------------------------------------------------------------
   3. Ein Formularfeld gehoert einem BEREICH

   Eine Seite (`app.slug`) wird von einer ROLLE gefuehrt und kennt keinen
   Bereich — die drei Achsen sind getrennt, und das ist richtig. Ein Formular
   braucht aber einen: seine Beschriftung liegt unter einem Epochenschluessel,
   und die Einsendungen liegen unter einem Annahmeschluessel, der an einem
   Bereich haengt.

   Also sagt das FELD, wohin es gehoert. Je Feld und nicht je Baustein, aus
   demselben Grund wie bei `app.calendar_field` (0020): dann kann ein Formular
   Fragen stellen, deren Antworten an verschiedene Stellen gehen — die Anmeldung
   an die Pfarrei, die Gesundheitsangabe an die Leitung der Freizeit. Mit einem
   Bereich je Baustein muesste man dafuer zwei Formulare bauen und den Menschen
   zweimal fragen.
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.slug_field', 'area_id') IS NULL
    ALTER TABLE app.slug_field ADD area_id uniqueidentifier NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug_field')
             AND name = 'area_id' AND is_nullable = 1)
    ALTER TABLE app.slug_field ALTER COLUMN area_id uniqueidentifier NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_field_area')
    ALTER TABLE app.slug_field ADD CONSTRAINT fk_slug_field_area
        FOREIGN KEY (area_id) REFERENCES app.area (id);
GO

/* -------------------------------------------------------------------------
   4. Die eigene Einsendung wiederlesen
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.registration_value', 'seat_key_sealed') IS NULL
    ALTER TABLE app.registration_value ADD seat_key_sealed varbinary(max) NULL;
GO
