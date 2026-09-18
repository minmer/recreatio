/*
    Das Portal ist eine SEITE.

    =========================================================================
    DER BEFUND
    =========================================================================

    `SeatPortal.tsx` hatte seine Abschnitte fest eingebaut: eine Nachricht vom
    Amt, das Gemeinsame, die eigene Einsendung. Wer etwas anderes dazusagen
    wollte — wann das erste Treffen ist, was mitzubringen ist, an wen man sich
    wendet —, konnte es nicht: dafuer haette jemand die Anwendung aendern und
    neu ausliefern muessen.

    Fuer jede andere Seite gibt es das laengst. `app.slug_part` traegt
    Bausteine, der Editor schiebt sie im Raster, und `PageParts` zeichnet sie.
    Das Portal bekommt keine zweite Maschinerie daneben, sondern DIESE.

    =========================================================================
    EINE VORLAGE JE BEREICH, NICHT JE MENSCH
    =========================================================================

    Alle Firmlinge sehen denselben Aufbau; verschieden ist, was in den
    persoenlichen Bausteinen steht. Die Vorlage haengt deshalb am BEREICH und
    nicht am Platz — sonst muesste die Kanzlei sie zweihundertmal pflegen.

        app.area_portal   Bereich  ->  Seite, die sein Portal zeichnet

    Ein Bereich hat hoechstens eine; deshalb ist `area_id` der Schluessel und
    nicht bloss ein Index.

    =========================================================================
    WARUM EINE SLUG-ZEILE UND KEINE NEUE TABELLE
    =========================================================================

    Weil daran alles schon haengt: Bausteine, der Editor, das Recht, sie zu
    aendern (`Access.OfAsync`), und die Pruefung, wer sie sehen darf (0026).
    Eine eigene `portal_part`-Tabelle waere eine zweite Fassung derselben Sache,
    und die zweite Fassung ist immer die, die eine Verbesserung nicht mitbekommt.

    <b>Oeffentlich ist sie trotzdem nicht.</b> Die Vorlage wird als INTERNE
    Adresse angelegt (0026, `internal_for_role_id` = das Amt): wer sie tippt,
    bekommt 404, das Amt bearbeitet sie wie jede andere Seite, und der Platz
    bekommt ihre Bausteine ueber `GET /seat/{token}` — einen Weg, der den Link
    prueft und nicht die Adresse.

    =========================================================================
    ES WIRD NICHTS GELOESCHT
    =========================================================================

    Diese Wanderung legt EINE Tabelle an und ruehrt keine Zeile an. Portale, die
    heute ohne Vorlage auskommen, zeichnen weiter ihre eingebauten Abschnitte —
    der Dienst schickt dann einfach keine Bausteine mit.
*/

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'area_portal')
BEGIN
    CREATE TABLE app.area_portal
    (
        area_id    uniqueidentifier NOT NULL,

        /*
            Die Seite, deren Bausteine das Portal zeichnen. Sie ist eine ganz
            gewoehnliche Adresse — mit Rahmen, Editor und Rechten.
        */
        slug_id    uniqueidentifier NOT NULL,

        created_at datetimeoffset NOT NULL,

        CONSTRAINT pk_area_portal PRIMARY KEY (area_id),
        CONSTRAINT fk_area_portal_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_area_portal_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id)
    );
END
GO

/*
    „Welcher Bereich zeichnet sich aus DIESER Seite" — die Frage beim Loeschen
    einer Adresse und beim Bearbeiten: der Editor soll dazusagen koennen, dass
    diese Seite ein Portal ist.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_area_portal_slug')
    CREATE INDEX ix_area_portal_slug ON app.area_portal (slug_id);
GO
