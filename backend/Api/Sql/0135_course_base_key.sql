/*
    0135 — DIE GEWÄHLTE BAZA EINES KURSES wird gemerkt: app.area_import_key kennt
    dazu die Art `library` (Schlüssel `base` = die Baza, die der Kurs zeigt).

    Bisher galt die Baza als die des Kurses, deren Powtórka auf der Hauptseite steht;
    ohne Powtórka dort blieb nach „Wybierz inną" die alte vorn.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'ck_area_import_key_kind' AND parent_object_id = OBJECT_ID('app.area_import_key')
             AND definition NOT LIKE N'%library%')
BEGIN
    ALTER TABLE app.area_import_key DROP CONSTRAINT ck_area_import_key_kind;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'ck_area_import_key_kind' AND parent_object_id = OBJECT_ID('app.area_import_key'))
BEGIN
    ALTER TABLE app.area_import_key ADD CONSTRAINT ck_area_import_key_kind
        CHECK (item_kind IN (N'page', N'form', N'appointment', N'role', N'chat', N'link', N'question', N'library'));
END
GO
