/*
    DER MENSCH MIT DEM LINK FÄNGT AN (0081).

    Die Rozmowa „einer mit einem" (0069/0080) legte bisher immer ein Mitglied
    an — `created_by_role_id` war Pflicht. Jetzt kann der Mensch selbst
    anfangen: auf einer Seite steht der Baustein „Napisz do nas"
    (`seat-ask`), er nennt die Bereiche, an die man schreiben kann, und der
    Mensch mit seinem Link öffnet dort seine Rozmowa mit einem davon.

    Eine solche Rozmowa hat keine anlegende Rolle: angefangen hat der Platz,
    und der steht ohnehin in `seat_id`. Deshalb darf `created_by_role_id`
    leer sein — aber nur bei `kind = 'seat'`.

    Der Schlüssel kommt wie immer von einem Mitglied (`chat_seat_key`); bis
    dahin hält der Browser des Menschen, was er schreibt, und schickt es,
    sobald die Rozmowa aufgeht.
*/

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.chat') AND name = 'created_by_role_id' AND is_nullable = 0)
    ALTER TABLE app.chat ALTER COLUMN created_by_role_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_started' AND parent_object_id = OBJECT_ID('app.chat'))
    ALTER TABLE app.chat ADD CONSTRAINT ck_chat_started CHECK (created_by_role_id IS NOT NULL OR kind = N'seat');
GO
