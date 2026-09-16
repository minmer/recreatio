/*
    Eine Unteradresse, die NICHT jedem gehoert.

    =========================================================================
    DER BEFUND
    =========================================================================

    `GET /page/{pfad}` fragt niemanden. Jede uebernommene Adresse wird an jeden
    ausgeliefert, der sie tippt — und das war richtig, solange es nur Aushaenge
    gab.

    0003 kannte den Unterschied schon und schrieb ihn auf:

        „`kind` — Absicht, keine Ableitung: eine noch leere interne Seite
        gaebe sich sonst als oeffentlich aus."

    Mit `app.page` ist dieser Satz verschwunden, nicht seine Notwendigkeit.
    Hier kommt er zurueck, an die Adresse statt an die Seite.

    =========================================================================
    EINE SPALTE, KEIN SCHALTER
    =========================================================================

    Nicht `is_internal bit`, sondern WESSEN:

        NULL      oeffentlich, wie bisher
        eine Rolle  die Adresse gehoert IHR

    Ein blosser Schalter sagte „nicht oeffentlich" und liesse offen, fuer wen
    denn dann — die Antwort stuende danach in einer Bedingung, die jemand
    richtig schreiben muss. So steht sie in der Zeile.

    <b>Rolle und Mensch sind dasselbe Feld</b>, weil sie dasselbe Ding sind: ein
    Mensch ist eine Rolle der Art `person` (0011). `lo13/anna` zeigt auf Annas
    Personenrolle, `lo13/samorzad` auf ein Amt — und wer das Amt spaeter
    uebernimmt, erbt die Seite, ohne dass jemand sie umhaengen muesste. Genau
    dafuer gibt es Rollen.

    =========================================================================
    DREI WEGE HINEIN — UND KEIN VIERTER
    =========================================================================

        die Rolle halten     ueber das Konto, im Rollengraphen erreichbar
        schreiben duerfen    das Amt, das die Adresse fuehrt (0012)
        einen PLATZ haben    `app.access_slug` — der Link, ohne Konto

    Der dritte ist der Grund, warum es hier nicht bei einer Rollenpruefung
    bleibt: ein Vierzehnjaehriger hat kein Konto und damit keine Rolle. Die
    Tabelle dafuer steht seit 0022 und hat bis heute nichts getan — das war
    ihre Aufgabe.

    <b>Wer nicht hineindarf, bekommt 404 und nicht 403.</b> Dieselbe Antwort wie
    fuer eine Adresse, die es nicht gibt: der Unterschied verriete, dass unter
    `lo13/anna` jemand gefuehrt wird, und das ist bereits eine Auskunft ueber
    Anna.
*/

IF COL_LENGTH('app.slug', 'internal_for_role_id') IS NULL
    ALTER TABLE app.slug ADD internal_for_role_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_internal_role')
    ALTER TABLE app.slug ADD CONSTRAINT fk_slug_internal_role
        FOREIGN KEY (internal_for_role_id) REFERENCES app.role (id);
GO

/*
    „Welche Adressen gehoeren dieser Rolle" — die Frage des Arbeitsplatzes,
    wenn jemand seine eigenen Seiten sucht.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_internal_role')
    CREATE INDEX ix_slug_internal_role ON app.slug (internal_for_role_id)
        WHERE internal_for_role_id IS NOT NULL;
GO
