/*
    KROK „WYBIERZ TERMIN" (0100) — ein Schritt eines Formulars, der sich von
    selbst erledigt, sobald der Mensch über seinen Link einen Termin bei einem
    Zasób genommen hat (oder darum gebeten: wartend zählt) — etwa „Spotkanie
    26/27" der Kandydaci.

        kind         booking (neben mark und task)
        resource_id  bei welchem Zasób (ohne Fremdschlüssel: wird er gelöscht,
                     kann der Schritt nicht mehr erledigt werden, und das sagt er)

    Der Dienst rechnet „erledigt" aus den Rezerwacje (`app.claim`, je Platz)
    und meldet es wie einen Haken (`step_mark`); gespeichert wird nichts dazu.
*/

IF COL_LENGTH('app.form_step', 'resource_id') IS NULL
    ALTER TABLE app.form_step ADD resource_id uniqueidentifier NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_kind' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_kind;
GO

ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_kind CHECK (kind IN (N'mark', N'task', N'booking'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_task;
GO

ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_task CHECK (
    kind = N'mark'
    OR (kind = N'booking' AND resource_id IS NOT NULL AND done_by = N'person' AND visible_to_person = 1)
    OR (kind = N'task'
        AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on >= starts_on
        AND schedule IN (N'any', N'daily', N'weekly', N'item')
        AND (schedule <> N'weekly' OR weekdays BETWEEN 1 AND 127)
        AND (schedule <> N'item' OR item_id IS NOT NULL)
        AND (presence = 0 OR schedule = N'item')
        AND (at_minute IS NULL OR at_minute BETWEEN 0 AND 1439)
        AND (minutes IS NULL OR minutes BETWEEN 1 AND 1440)
        AND (needed IS NULL OR needed BETWEEN 1 AND 400)
        AND (show_from IS NULL OR show_from <= starts_on)
        AND (report_until IS NULL OR report_until >= ends_on)
        AND done_by IN (N'person', N'office') AND visible_to_person = 1));
GO
