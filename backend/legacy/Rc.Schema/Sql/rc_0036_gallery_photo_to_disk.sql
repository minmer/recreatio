/*
    Die Bilder der Galerie gehoeren auf die Platte, nicht in die Zeile.

    =========================================================================
    DER BEFUND
    =========================================================================

    105 Fotos, 60,8 MB reine JPEG- und WebP-Bytes, in `events.EventGalleryPhotos.Data`
    (varbinary(max)). Das ist die HAELFTE der Datendatei:

        Datendatei      123,3 MB von 250 MB (harte Grenze des Hosters)
        davon frei        0,2 MB
        Galerie          63,0 MB  ← 51 %
        EventImages       4,1 MB
        alles andere     56,0 MB  (Suchindex, Statistik, Zeilen)

    Die Datei waechst in Schritten von 1 MB gegen eine Obergrenze von 250 MB.
    Wird sie erreicht, scheitern nicht die Uploads — es scheitert JEDES
    SCHREIBEN: die Anmeldung eines Firmkandidaten, die Messintention, die
    Sitzung beim Anmelden. Ein volles Datenbankfile ist ein Totalausfall mit
    einer sehr harmlosen Fehlermeldung.

    =========================================================================
    WARUM EIN BILD DORT UEBERHAUPT FALSCH LIEGT
    =========================================================================

    Nicht aus Ordnungsliebe. Ein Bild in der Zeile kostet dreimal:

      1. Es faellt unter das Datenbankkontingent, das teuer und klein ist,
         waehrend daneben Plattenplatz liegt, der billig und gross ist. Beim
         Hoster steht „Pliki: 0 MB" — der Platz ist da und leer.

      2. Es geht in JEDE Sicherung. Eine Datenbanksicherung, die zur Haelfte
         aus Urlaubsfotos besteht, dauert zehnmal so lang und wird deshalb
         seltener gemacht.

      3. Es geht durch den Arbeitsspeicher des Dienstes, wenn es ausgeliefert
         wird — `Results.File(byte[])` haelt das ganze Bild im Speicher. Von
         der Platte ist es ein Datenstrom.

    Was in der Zeile BLEIBT, ist alles, was klein ist und wonach man sucht:
    wer es geschickt hat, wann, wie es heisst, wie gross es ist. Nur die
    Bytes ziehen um.

    =========================================================================
    WAS DIESE MIGRATION TUT — UND WAS NICHT
    =========================================================================

    Sie legt nur die Spalten an. Sie BEWEGT NICHTS.

    Umziehen kann ein SQL-Skript nicht: es muesste Dateien schreiben, und
    genau das darf es nicht koennen. Den Umzug macht der Dienst — Foto fuer
    Foto, mit Pruefung nach jedem, wiederaufnehmbar. Angestossen wird er beim
    naechsten Anmelden des Verwalters.

    `Data` wird NULLABLE, aber nichts wird geleert. Solange `StoragePath`
    leer ist, gilt weiter die Zeile. Beide Wege stehen also eine Zeit lang
    nebeneinander, und das ist Absicht: waere es ein Stichtag, gaebe es einen
    Augenblick, in dem die Bilder weg sind und die Dateien noch nicht da.

    =========================================================================
    WARUM DIESE MIGRATION HIER LIEGT
    =========================================================================

    `events.EventGalleryPhotos` gehoert zum ALTBESTAND (`Recreatio.Api`,
    `Sql/patch_events.sql`). Dessen Skripte werden von Hand eingespielt — es
    gibt dort keinen Laufwerk. Der rc-Migrationslauf spricht mit DERSELBEN
    Datenbank, fuehrt Buch darueber, was angewendet wurde, und laesst sich
    wiederholen. Eine Aenderung, die von Hand eingespielt werden muss, wird
    irgendwo vergessen; das ist der ganze Grund.
*/

/*
    WO DIE DATEI LIEGT.

    Ein RELATIVER Pfad unterhalb des Ablageordners, nicht der ganze — sonst
    stuende der Ordner des Entwicklungsrechners in 105 Zeilen, und ein Umzug
    auf einen anderen Hoster hiesse 105 Zeilen umschreiben.

    NULL heisst: liegt noch in `Data`. Das ist der Zustand, in dem heute alle
    105 sind.
*/
IF COL_LENGTH('events.EventGalleryPhotos', 'StoragePath') IS NULL
BEGIN
    ALTER TABLE events.EventGalleryPhotos ADD StoragePath nvarchar(400) NULL;
END
GO

/*
    WOMIT GEPRUEFT WIRD, DASS DIE DATEI HEIL ANGEKOMMEN IST.

    Der Umzug loescht Bytes. Er darf sie erst loeschen, wenn feststeht, dass
    dieselben Bytes woanders liegen — nicht „eine Datei dieser Groesse", die
    auch ein halb geschriebener Rest sein kann. Ohne diese Spalte waere die
    Pruefung ein Groessenvergleich, und ein Groessenvergleich ist bei einem
    abgebrochenen Schreibvorgang genau dann gruen, wenn er es nicht sein darf.

    Sie bleibt danach nuetzlich: sie sagt beim Ausliefern, ob die Datei auf
    der Platte noch die ist, die einmal hochgeladen wurde.
*/
IF COL_LENGTH('events.EventGalleryPhotos', 'ContentSha256') IS NULL
BEGIN
    ALTER TABLE events.EventGalleryPhotos ADD ContentSha256 varbinary(32) NULL;
END
GO

/*
    `Data` darf leer werden — vorher NOT NULL.

    Erst danach kann der Umzug ueberhaupt etwas leeren. Die Spalte bleibt
    stehen: eine geleerte varbinary(max)-Spalte kostet nichts, und sie ist
    der Rueckweg, solange noch nicht alles umgezogen ist.
*/
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('events.EventGalleryPhotos')
      AND name = 'Data' AND is_nullable = 0)
BEGIN
    ALTER TABLE events.EventGalleryPhotos ALTER COLUMN Data varbinary(max) NULL;
END
GO

/*
    „Was ist noch nicht umgezogen" — die Frage, die der Umzug bei jedem Lauf
    stellt und die ohne Index durch alle Zeilen geht. Gefiltert, weil sie nur
    die noch nicht umgezogenen betrifft: sobald alle umgezogen sind, ist der
    Index leer und kostet nichts mehr.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_EventGalleryPhotos_pending')
BEGIN
    CREATE INDEX ix_EventGalleryPhotos_pending
        ON events.EventGalleryPhotos (Id)
        WHERE StoragePath IS NULL;
END
GO
