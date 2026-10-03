/*
    DER MENSCH MIT DEM LINK FÄNGT AN (0081).

    Die Rozmowa „einer mit einem" (0069/0080) legte bisher immer ein Mitglied
    an — `created_by_role_id` war Pflicht. Jetzt kann der Mensch selbst
    anfangen: auf einer Seite steht der Baustein „Napisz do nas"
    (`seat-ask`), er hat die Rollen, die antworten (in seinem eigenen
    Bereich), und die Formulare, deren Menschen schreiben dürfen; der Mensch
    mit seinem Link öffnet dort seine Rozmowa mit ihnen.

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

/*
    UND WER AN DEN BAUSTEIN SCHREIBEN DARF: die Menschen seiner Formulare.

    Der Baustein „Napisz do nas" ist ein Ding mit Odbiorcy (0080): sein Bereich
    — eigens für ihn angelegt, mit genau den Rollen, die antworten — und die
    Formulare, deren Menschen dort anfangen dürfen (`app.audience_form`,
    `subject_kind = 'module'`).
*/
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_audience_kind' AND parent_object_id = OBJECT_ID('app.audience_form') AND definition NOT LIKE '%module%')
    ALTER TABLE app.audience_form DROP CONSTRAINT ck_audience_kind;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_audience_kind' AND parent_object_id = OBJECT_ID('app.audience_form'))
    ALTER TABLE app.audience_form ADD CONSTRAINT ck_audience_kind CHECK (subject_kind IN (N'chat', N'module'));
GO
