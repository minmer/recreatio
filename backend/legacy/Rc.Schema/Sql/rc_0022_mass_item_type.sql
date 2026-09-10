/*
    Die Messe als Eintragstyp — in der Datenbank.

    WARUM ZWEI BEDINGUNGEN UND NICHT EINE.

    Der Dienst kennt seit rc_0020 Messen, und der oeffentliche Messplan sucht
    Eintraege vom Typ 'mass'. Anlegen liess sich ein solcher Eintrag aber nie:
    zwei Bedingungen wiesen ihn ab, und die zweite ist die unauffaelligere.

      ck_rc_item_type  — zaehlt die erlaubten Typen auf: task, appointment.

      ck_rc_item_task  — sagt, wann task_state gesetzt sein darf, und tat das
                         so:

                             (item_type = 'task'        AND task_state IN (…))
                          OR (item_type = 'appointment' AND task_state IS NULL)

                         Damit ist der Aufgabenzustand nicht bloss geregelt —
                         die Bedingung zaehlt nebenbei ein zweites Mal die
                         Typen auf. Ein 'mass' ohne task_state faellt durch,
                         obwohl es an dieser Regel gar nicht scheitern sollte.

    Zwei Stellen, die dieselbe Liste fuehren, laufen auseinander. Genau das ist
    hier geschehen: die erste haette man erweitert, die zweite uebersehen, und
    der Fehler waere derselbe geblieben — nur schwerer zu finden.

    Deshalb wird die zweite Bedingung nicht erweitert, sondern auf das
    zurueckgefuehrt, was sie sagen will: NUR Aufgaben haben einen
    Aufgabenzustand. Alles andere hat keinen — was immer sonst noch dazukommt.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_item_type')
BEGIN
    ALTER TABLE dbo.rc_calendar_item DROP CONSTRAINT ck_rc_item_type;
END
GO

ALTER TABLE dbo.rc_calendar_item ADD CONSTRAINT ck_rc_item_type
    CHECK (item_type IN (N'appointment', N'task', N'mass'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_item_task')
BEGIN
    ALTER TABLE dbo.rc_calendar_item DROP CONSTRAINT ck_rc_item_task;
END
GO

/*
    Dieselbe Regel, ohne die Typenliste ein zweites Mal zu fuehren.

    Vorher: „task hat einen Zustand ODER appointment hat keinen."
    Jetzt:  „task hat einen Zustand, alles andere hat keinen."

    Was der naechste Typ ist, muss diese Bedingung nicht mehr wissen.
*/
ALTER TABLE dbo.rc_calendar_item ADD CONSTRAINT ck_rc_item_task CHECK (
       (item_type =  N'task' AND task_state IN (N'todo', N'doing', N'done', N'cancelled'))
    OR (item_type <> N'task' AND task_state IS NULL));
GO
