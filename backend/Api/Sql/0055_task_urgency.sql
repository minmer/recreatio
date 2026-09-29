/*
    DRINGLICHKEIT UND ABGESAGTES (0055)

    Zwei Dinge, die den Aufgaben aus 0054 gefehlt haben.

    1. ABGESAGT. Bisher gab es nur „erledigt" oder gar nichts, und was nicht
       erledigt wurde, blieb für immer versäumt. Wer sagt „dieses eine Mal
       nicht", trifft aber eine Entscheidung, und sie ist etwas anderes als
       Vergessen: die Aufgabe hört auf zu drängen, ohne zu behaupten, sie sei
       getan. Darum bekommt die Zeile einen Zustand statt eines zweiten
       Tisches — es ist dieselbe Tatsache („damit ist dieses Vorkommen
       erledigt"), nur mit zwei Ausgängen.

    2. LÄNGERE FENSTER. `window_minutes` war auf eine Woche begrenzt, weil ein
       Fenster als „das Gebet zwischen 21:00 und 21:15" gedacht war. Sobald
       Anfang UND Ende frei wählbar sind, ist „zwischen dem 1. und dem 15.
       Oktober" eine ganz gewöhnliche Aufgabe, und die Grenze stand nur im Weg.
       Ein Jahr ist die neue Grenze — darüber hinaus ist es kein Fenster mehr,
       sondern ein Vorsatz.
*/

IF COL_LENGTH('app.task_done', 'state') IS NULL
    ALTER TABLE app.task_done
        ADD state nvarchar(8) NOT NULL CONSTRAINT df_task_done_state DEFAULT (N'done');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_done_state')
    ALTER TABLE app.task_done
        ADD CONSTRAINT ck_task_done_state CHECK (state IN (N'done', N'skipped'));
GO

/* Ein Fenster darf jetzt bis zu einem Jahr offen stehen. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_window')
    ALTER TABLE app.task DROP CONSTRAINT ck_task_window;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_window')
    ALTER TABLE app.task
        ADD CONSTRAINT ck_task_window CHECK (window_minutes BETWEEN 0 AND 527040);
GO
