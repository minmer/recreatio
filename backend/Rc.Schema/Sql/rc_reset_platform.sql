/* ===========================================================================
   Die Plattform-Tabellen entfernen — damit der Migrationslauf neu anfangen kann.

   WOFUER DAS DA IST

   Der Lauf bricht mit "There is already an object named 'rc_account'" ab, und
   dbo.rc_schema_version ist leer. Beides zusammen heisst: die Tabellen stehen
   da, aber niemand hat aufgeschrieben, WELCHE Fassung sie sind. Der Lauf kann
   sie deshalb weder ueberspringen (er weiss nicht, ob sie stimmen) noch
   anlegen (sie sind schon da). Diese Sackgasse loest sich nur, indem man
   entweder das Verzeichnis nachtraegt oder die Tabellen entfernt.

   NACHTRAGEN WAERE DIE SCHLECHTERE WAHL. Es hiesse zu behaupten, die
   vorhandenen Tabellen entsprechen genau diesen zwoelf Skripten — und das
   weiss niemand. Stammen sie aus einem aelteren Stand, faellt das erst auf,
   wenn eine Spalte fehlt, die eine Abfrage erwartet. Entfernen und neu
   anlegen gibt dagegen einen Zustand, den man kennt.

   ---------------------------------------------------------------------------
   ZWEI SCHRITTE, UND DER ERSTE IST DER WICHTIGE

   Schritt 1 zaehlt die Zeilen. Er aendert nichts. Erst wenn dort ueberall 0
   steht, ist Schritt 2 verlustfrei — und das ist er hier, solange sich noch
   niemand anmelden konnte.

   Schritt 2 gibt den Loeschbefehl zunaechst nur AUS. Ausgefuehrt wird er erst,
   wenn die letzte Zeile entkommentiert ist. Ein Skript, das eine
   Produktionsdatenbank beim ersten Aufruf leert, ist eine Falle.

   ---------------------------------------------------------------------------
   WAS ES ANFASST, UND WAS NICHT

   Ausschliesslich Objekte mit dem Praefix rc_ im Schema dbo: 59 Tabellen und
   die zehn Ausloeser darauf, die mit ihren Tabellen verschwinden. KEINE
   Tabelle des Altbestands traegt dieses Praefix — geprueft gegen alle 384.

   Das Suchmuster ist 'rc[_]%' und nicht 'rc_%': der Unterstrich ist in LIKE
   ein Platzhalter fuer ein beliebiges Zeichen. 'rc_%' traefe auch rcx_irgendwas.
   =========================================================================== */

/* --- SCHRITT 1: nachsehen. Aendert nichts. ------------------------------- */

SELECT
    t.name                                   AS tabelle,
    SUM(CASE WHEN p.index_id IN (0, 1) THEN p.rows ELSE 0 END) AS zeilen
FROM sys.tables t
LEFT JOIN sys.partitions p ON p.object_id = t.object_id
WHERE t.name LIKE 'rc[_]%'
  AND SCHEMA_NAME(t.schema_id) = 'dbo'
GROUP BY t.name
ORDER BY zeilen DESC, t.name;

/* Wie viele der zwoelf Skripte sind verzeichnet? Erwartet: 0 bei leerem
   Verzeichnis, 12 nach einem vollstaendigen Lauf. */
SELECT COUNT(*) AS verzeichnete_skripte FROM dbo.rc_schema_version;


/* --- SCHRITT 2: entfernen. Erst lesen, dann ausfuehren. ------------------ */

DECLARE @sql nvarchar(max) = N'';

/* Erst die Fremdschluessel. Sonst muesste die Reihenfolge des Loeschens der
   Abhaengigkeit folgen, und die ist bei neunundfuenfzig Tabellen nichts, was
   man von Hand richtig hinschreibt. */
SELECT @sql += N'ALTER TABLE dbo.' + QUOTENAME(t.name)
             + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';' + CHAR(13) + CHAR(10)
FROM sys.foreign_keys f
JOIN sys.tables t ON t.object_id = f.parent_object_id
WHERE t.name LIKE 'rc[_]%'
  AND SCHEMA_NAME(t.schema_id) = 'dbo';

/* Dann die Tabellen. Die Ausloeser haengen daran und gehen mit. */
SELECT @sql += N'DROP TABLE dbo.' + QUOTENAME(name) + N';' + CHAR(13) + CHAR(10)
FROM sys.tables
WHERE name LIKE 'rc[_]%'
  AND SCHEMA_NAME(schema_id) = 'dbo';

PRINT @sql;

/* Erst lesen, was oben steht. Dann diese Zeile entkommentieren: */
-- EXEC sp_executesql @sql;
