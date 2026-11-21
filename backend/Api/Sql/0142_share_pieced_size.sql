/*
    0142 — GROSSE PLIKI PRZEZ LINK (2026-11-21, zu 0117): seit den Stücken
    (`Phone.ShareParts.cs`) darf ein Link bis 250 MB tragen — die Regel aus 0117
    liess nur 25 MB und ihre Hülle zu, und ein grösserer Film scheiterte erst beim
    Anlegen der Zeile (500 nach dem letzten Stück).

    Neue Grenze: 250 MB + 1 MB, genau wie `MaxSharePieced` im Dienst.
    Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_phone_share_length' AND parent_object_id = OBJECT_ID('app.phone_share')
             AND definition NOT LIKE N'%263192576%')
    ALTER TABLE app.phone_share DROP CONSTRAINT ck_phone_share_length;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = 'ck_phone_share_length' AND parent_object_id = OBJECT_ID('app.phone_share'))
    ALTER TABLE app.phone_share WITH CHECK
        ADD CONSTRAINT ck_phone_share_length CHECK (byte_length BETWEEN 32 AND 263192576);
GO
