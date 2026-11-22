/*
    0144 — DIE KLASSE (2026-11-22, Part B): zwei neue Arten einer Cogita-Sitzung (0109).

        lesson   eine Unterrichtsstunde: eine Erzählung (oder mehrere nacheinander), die die Klasse
                 zusammen geht — der Leiter drückt „Dalej", jede und jeder stimmt einzeln ab, die
                 Verteilung sieht der Leiter sofort; die Antwort der Klasse führt die Erzählung weiter.
        task     eine Zadanie: ein Ziel (Turm, Erzählung oder Wiederholung) + die Klasse (der Bereich
                 der Sitzung) + die Frist (ends_at) als EIN Ding. Erledigt wird nie gespeichert — der
                 Browser rechnet es aus dem Fortschritt.

    Nur die Regel ck_cogita_session_kind ändert sich. Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_cogita_session_kind' AND parent_object_id = OBJECT_ID('app.cogita_session')
             AND definition NOT LIKE N'%''lesson''%')
    ALTER TABLE app.cogita_session DROP CONSTRAINT ck_cogita_session_kind;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_cogita_session_kind' AND parent_object_id = OBJECT_ID('app.cogita_session'))
    ALTER TABLE app.cogita_session ADD CONSTRAINT ck_cogita_session_kind
        CHECK (kind IN (N'live', N'async', N'sync', N'story', N'game', N'shared', N'lesson', N'task'));
GO
