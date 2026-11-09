/*
    0141 — ZADANIA „RAZ W TYGODNIU" / „RAZ W MIESIĄCU" (2026-11-09): eine Aufgabe für die
    Menschen eines Formulars (0098) kann jetzt auch verlangen, dass sie in JEDER Woche (Mo–So)
    oder in JEDEM Monat ihres Zeitraums getan wird — an einem beliebigen Tag darin:

        schedule   week    jede Woche des Zeitraums
                   month   jeder Monat des Zeitraums
        needed     wie oft JE Woche / Monat (fehlt: einmal) — höchstens 7 / 31

    Jeder Tag des Zeitraums gilt (wie `daily`); eine angebrochene Woche (ein angebrochener
    Monat) am Rand zählt mit ihren Tagen im Zeitraum. Ob jede Woche genug Tage hat, rechnet
    der Browser, wie bisher bei allen Aufgaben.

    Nur die Regel ck_form_step_task ändert sich — sonst genau wie zuletzt in 0109.
    Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step')
             AND definition NOT LIKE N'%''month''%')
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_task;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_task CHECK (
        kind = N'mark'
        OR (kind = N'booking' AND resource_id IS NOT NULL AND done_by = N'person' AND visible_to_person = 1)
        OR (kind = N'chat' AND chat_kind IN (N'all', N'seat', N'area', N'channel') AND done_by = N'person' AND visible_to_person = 1)
        OR (kind = N'learn' AND learn_library_id IS NOT NULL AND learn_threshold BETWEEN 0 AND 1 AND done_by = N'person' AND visible_to_person = 1)
        OR (kind = N'task'
            AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on >= starts_on
            AND schedule IN (N'any', N'daily', N'weekly', N'week', N'month', N'item')
            AND (schedule <> N'weekly' OR weekdays BETWEEN 1 AND 127)
            AND (schedule <> N'item' OR item_id IS NOT NULL)
            AND (presence = 0 OR schedule = N'item')
            AND (at_minute IS NULL OR at_minute BETWEEN 0 AND 1439)
            AND (minutes IS NULL OR minutes BETWEEN 1 AND 1440)
            AND (needed IS NULL OR needed BETWEEN 1 AND 400)
            AND (schedule <> N'week' OR needed IS NULL OR needed <= 7)
            AND (schedule <> N'month' OR needed IS NULL OR needed <= 31)
            AND (show_from IS NULL OR show_from <= starts_on)
            AND (report_until IS NULL OR report_until >= ends_on)
            AND done_by IN (N'person', N'office') AND visible_to_person = 1));
GO
