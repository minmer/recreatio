/*
    ALLES IM SCHEMA `app` WEGWERFEN.

    -------------------------------------------------------------------------
    WAS DIESE DATEI NICHT ANFASST
    -------------------------------------------------------------------------

    Das Schema `dbo` derselben Datenbank. Dort liegt der ALTBESTAND — die
    rc_*-Tabellen und die alte Recreatio.Api —, und der bedient recreatio.pl,
    solange die neue Oberflaeche nicht ausgeliefert ist. Ihn hier mitzunehmen
    hiesse, die laufende Seite abzuschalten, um die neue aufzuraeumen.

    Fuer den Altbestand gibt es `0000_drop_legacy.sql`, und der ist
    absichtlich nur mit `--drop-legacy` zu bekommen. Das bleibt eine eigene
    Entscheidung.

    -------------------------------------------------------------------------
    WARUM DIE REIHENFOLGE AUS DEM KATALOG KOMMT
    -------------------------------------------------------------------------

    Eine von Hand gepflegte Loeschreihenfolge war in diesem Haus schon fuenfmal
    falsch: jedes Mal kam eine Tabelle dazu, die vor einer anderen gehen musste,
    und jedes Mal fiel es erst auf, als das Aufraeumen scheiterte.

    Deshalb wird hier nichts aufgezaehlt. Erst fallen ALLE Fremdschluessel —
    danach gibt es keine Abhaengigkeiten mehr, und die Tabellen koennen in
    beliebiger Reihenfolge fort. Das ist unempfindlich gegen jede kuenftige
    Tabelle, weil es keine Liste gibt, die jemand nachfuehren muesste.

    -------------------------------------------------------------------------
    WAS DAS KOSTET
    -------------------------------------------------------------------------

    Alles. Konten, Rollen, Schluessel, das Register mit seinen Adressen, die
    Seiten und ihre Bausteine, die Messen — und `app.schema_version`, also das
    Gedaechtnis darueber, welche Wanderungen schon gelaufen sind.

    Die Codes, die je ausgegeben wurden, sind danach wertlos: gespeichert war
    nur ihr SHA-256, und der geht mit.

    Nicht umkehrbar. Es gibt keine Sicherung, die dieses Skript anlegt.
*/

SET NOCOUNT ON;

DECLARE @sql nvarchar(max);

/* -------------------------------------------------------------------------
   1. Fremdschluessel
   ------------------------------------------------------------------------- */

SET @sql = N'';

SELECT @sql = @sql
    + N'ALTER TABLE app.' + QUOTENAME(OBJECT_NAME(fk.parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(fk.name) + N';' + CHAR(13) + CHAR(10)
FROM sys.foreign_keys fk
JOIN sys.schemas s ON s.schema_id = fk.schema_id
WHERE s.name = N'app';

IF LEN(ISNULL(@sql, N'')) > 0 EXEC sp_executesql @sql;

/* -------------------------------------------------------------------------
   2. Sichten und Routinen

   Heute gibt es keine. Sie stehen trotzdem hier: eine Datei, die „alles"
   verspricht und nur Tabellen kann, laesst beim ersten Mal etwas stehen — und
   dann scheitert das Anlegen an einem Namen, den niemand mehr erwartet.
   ------------------------------------------------------------------------- */

SET @sql = N'';

SELECT @sql = @sql
    + N'DROP ' + CASE o.type
                    WHEN 'V'  THEN N'VIEW'
                    WHEN 'P'  THEN N'PROCEDURE'
                    WHEN 'FN' THEN N'FUNCTION'
                    WHEN 'IF' THEN N'FUNCTION'
                    WHEN 'TF' THEN N'FUNCTION'
                 END
    + N' app.' + QUOTENAME(o.name) + N';' + CHAR(13) + CHAR(10)
FROM sys.objects o
JOIN sys.schemas s ON s.schema_id = o.schema_id
WHERE s.name = N'app' AND o.type IN ('V', 'P', 'FN', 'IF', 'TF');

IF LEN(ISNULL(@sql, N'')) > 0 EXEC sp_executesql @sql;

/* -------------------------------------------------------------------------
   3. Tabellen

   Ohne Fremdschluessel ist die Reihenfolge gleichgueltig.
   ------------------------------------------------------------------------- */

SET @sql = N'';

SELECT @sql = @sql + N'DROP TABLE app.' + QUOTENAME(t.name) + N';' + CHAR(13) + CHAR(10)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = N'app';

IF LEN(ISNULL(@sql, N'')) > 0 EXEC sp_executesql @sql;

/* -------------------------------------------------------------------------
   4. Das Schema selbst

   `create_all.sql` legt es neu an. Es stehen zu lassen waere kein Schaden,
   aber dann hiesse „alles weggeworfen" nicht ganz, was es sagt.
   ------------------------------------------------------------------------- */

IF SCHEMA_ID('app') IS NOT NULL EXEC('DROP SCHEMA app');

/* -------------------------------------------------------------------------
   5. Nachsehen, ob wirklich nichts blieb
   ------------------------------------------------------------------------- */

SELECT (SELECT COUNT(*) FROM sys.tables t
        JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = N'app') AS tables_left,
       (SELECT COUNT(*) FROM sys.schemas WHERE name = N'app') AS schema_left;
