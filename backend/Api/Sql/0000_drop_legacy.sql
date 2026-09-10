/*
    ===========================================================================
    DER ALTBESTAND WIRD ENTFERNT. VOLLSTAENDIG. NICHT UMKEHRBAR.
    ===========================================================================

    Dieses Skript loescht JEDE Tabelle ausserhalb des Schemas `app` — 331 in
    zwoelf Schemata, samt allem, was darin steht:

        dbo 235   calendar 15   events 16   library 15   limanowa 12
        pilgrimage 9   event2 9   chat 6    hortus 5    forms 4
        edk 3     rowerowa 2

    -------------------------------------------------------------------------
    VORHER: DIE BILDER HOLEN
    -------------------------------------------------------------------------

    In `events.EventGalleryPhotos` liegen 105 Fotos, rund 61 MB, und in
    `events.EventImages` weitere fuenf. Sie sind das Einzige in dieser
    Datenbank, das sich nicht wiederherstellen laesst — Messzeiten kann man neu
    eintragen, ein Foto von einer Wallfahrt nicht.

    Der Sammeldownload dafuer ist gebaut
    (`/events/site/{slug}/parts/{partId}/photos.zip`), aber er sitzt im
    Altbestand und muss dafuer LAUFEN. Wer diesen Lauf startet, bevor die
    Pakete heruntergeladen sind, hat sie verloren.

    -------------------------------------------------------------------------
    WARUM ER NICHT VON SELBST LAEUFT
    -------------------------------------------------------------------------

    Er traegt die Nummer 0000 und stuende damit vor allen anderen — bei jedem
    `migrate` waere er der erste. Genau deshalb ueberspringt der Lauf ihn,
    solange nicht ausdruecklich

        dotnet run --project backend/Api -- migrate --drop-legacy

    gesagt wird. Ein zerstoerender Schritt, der aus Gewohnheit mitlaeuft, ist
    ein zerstoerender Schritt, der irgendwann zur falschen Zeit mitlaeuft.

    -------------------------------------------------------------------------
    WAS STEHEN BLEIBT
    -------------------------------------------------------------------------

    `app` — der Neubau. Kein Objekt darin wird angefasst.

    `dbo` und das Anmeldeschema behalten ihre HUELLE: ihre Tabellen fallen,
    die Schemata selbst nicht. `dbo` laesst sich ohnehin nicht entfernen, und
    das Anmeldeschema ist das Standardschema des Kontos — faellt es, kann sich
    der Dienst nicht mehr verbinden, und niemand kaeme auf diesen Grund.

    -------------------------------------------------------------------------
    DIE REIHENFOLGE
    -------------------------------------------------------------------------

    Erst alle Fremdschluessel, dann alle Tabellen, dann die leeren Schemata.
    Andersherum scheitert die erste Tabelle, auf die noch etwas zeigt — und
    zwar nach der Haelfte, mitten im Bestand.

    Alles laeuft in EINER Transaktion (der Lauf haelt sie): entweder ist der
    Altbestand fort, oder er ist unveraendert da. Ein halb geloeschter Bestand
    waere schlimmer als beides.
*/

SET NOCOUNT ON;

/* -------------------------------------------------------------------------
   1 · Die Fremdschluessel
   ------------------------------------------------------------------------- */

DECLARE @sql nvarchar(max);
DECLARE @done int = 0;

DECLARE @fk TABLE (statement nvarchar(max));

INSERT INTO @fk (statement)
SELECT 'ALTER TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name)
     + ' DROP CONSTRAINT ' + QUOTENAME(f.name) + ';'
FROM sys.foreign_keys f
JOIN sys.tables   t ON t.object_id = f.parent_object_id
JOIN sys.schemas  s ON s.schema_id = t.schema_id
WHERE s.name <> 'app';

WHILE EXISTS (SELECT 1 FROM @fk)
BEGIN
    SELECT TOP 1 @sql = statement FROM @fk;
    EXEC sp_executesql @sql;
    DELETE FROM @fk WHERE statement = @sql;
    SET @done = @done + 1;
END

/* -------------------------------------------------------------------------
   2 · Die Tabellen
   ------------------------------------------------------------------------- */

DECLARE @tab TABLE (statement nvarchar(max));

INSERT INTO @tab (statement)
SELECT 'DROP TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ';'
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name <> 'app';

WHILE EXISTS (SELECT 1 FROM @tab)
BEGIN
    SELECT TOP 1 @sql = statement FROM @tab;
    EXEC sp_executesql @sql;
    DELETE FROM @tab WHERE statement = @sql;
END

/* -------------------------------------------------------------------------
   3 · Die leeren Schemata
   -------------------------------------------------------------------------

   `dbo` und das Standardschema des angemeldeten Kontos bleiben stehen; die
   uebrigen sind jetzt leer und haben keinen Zweck mehr.

   Fremde Schemata (`sys`, `INFORMATION_SCHEMA`, die Rollenschemata) sind
   ausgenommen: sie gehoeren dem Server, nicht diesem Bestand.
*/

DECLARE @sch TABLE (statement nvarchar(max));

INSERT INTO @sch (statement)
SELECT 'DROP SCHEMA ' + QUOTENAME(s.name) + ';'
FROM sys.schemas s
WHERE s.name NOT IN ('app', 'dbo', 'sys', 'INFORMATION_SCHEMA', 'guest')
  AND s.name <> SCHEMA_NAME()
  AND s.principal_id = USER_ID()
  AND NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.schema_id = s.schema_id);

WHILE EXISTS (SELECT 1 FROM @sch)
BEGIN
    SELECT TOP 1 @sql = statement FROM @sch;
    EXEC sp_executesql @sql;
    DELETE FROM @sch WHERE statement = @sql;
END
GO
