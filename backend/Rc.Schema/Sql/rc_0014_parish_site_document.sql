/* ===========================================================================
   rc_0014 — Die Pfarrseite ist ein DOKUMENT, keine Liste

   `modules` trug bisher eine Liste: welche Bausteine vorkommen. Damit liess
   sich keine Seite einrichten — es fehlte, WO ein Baustein steht, wie GROSS er
   ist, welche Unterseiten es gibt und was auf ihnen steht.

   Jetzt steht dort ein Objekt:

       { "modules": [ … ], "menu": [ … ], "content": { … } }

   Die alte Bedingung verlangte eckige Klammern aussen und wies genau dieses
   Objekt ab. Sie wird ersetzt, nicht gelockert: eine Spalte, die als JSON
   gelesen wird, soll keinen Fliesstext aufnehmen.

   ISJSON steht hier weiterhin nicht — die Funktion gibt es erst ab
   Kompatibilitaetsgrad 130, und die Datenbank laeuft darunter. Was die
   Bedingung leistet, ist deshalb dasselbe wie vorher: sie faengt den Fall, der
   wirklich vorkommt (ein Text landet in der Spalte), und nicht den, bei dem
   jemand absichtlich kaputtes JSON schreibt. Gegen den zweiten hilft der
   Dienst, der den Wert selbst zusammensetzt und beim Speichern prueft.

   BESTEHENDE ZEILEN: keine. Diese Tabelle ist an einem Tag entstanden, an dem
   noch keine Pfarrei eine Seite eingerichtet hatte. Es wird nichts gewandelt —
   waere etwas da, muesste es hier stehen.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* Die alte Bedingung verlangte eine Liste. Sie muss weg, bevor die neue
   greifen kann — sonst gilt weiter beides, und beides zugleich ist unmoeglich
   zu erfuellen. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_parish_site_modules_list')
    ALTER TABLE dbo.rc_parish_site DROP CONSTRAINT ck_rc_parish_site_modules_list;
GO

/* Ein Objekt. Die Liste bleibt erlaubt, damit eine aeltere Fassung des
   Browser-Teils nichts kaputtmacht, solange beide nebeneinander laufen —
   der Dienst liest beide Formen. */
ALTER TABLE dbo.rc_parish_site
    ADD CONSTRAINT ck_rc_parish_site_document CHECK (
        (LEFT(LTRIM(modules), 1) = N'{' AND RIGHT(RTRIM(modules), 1) = N'}')
     OR (LEFT(LTRIM(modules), 1) = N'[' AND RIGHT(RTRIM(modules), 1) = N']')
    );
GO
