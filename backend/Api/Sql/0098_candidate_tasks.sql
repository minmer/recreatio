/*
    ZADANIA DLA OSÓB (0098) — eine Aufgabe für die Menschen eines Formulars,
    die eine ZEIT lang dasteht: „W październiku różaniec w kościele, codziennie
    o 18:00", „Różaniec po angielsku — piątki października", „Obejrzyj film
    (do końca miesiąca)". Der Mensch sagt, was er damit macht — przyjmuję,
    pomijam, odmawiam — und an welchen Tagen er es getan hat.

    Eine Aufgabe ist eine weitere ART von Schritt (form_step, 0047): neben dem
    Znacznik („Zgoda dostarczona", abgehakt einmal) steht jetzt die Aufgabe
    (`kind = 'task'`). Beschriftung und Erklärung (darin auch der Ort) liegen
    versiegelt wie beim Znacznik, unter dem Schlüssel des Formulars; der Plan
    steht offen, denn der Dienst prüft danach, welche Tage gelten:

        starts_on, ends_on   der Zeitraum („1.–31. Oktober")
        schedule             any     einmal, an einem beliebigen Tag darin
                             daily   jeden Tag
                             weekly  an den Wochentagen in `weekdays`
                                     (Bits: Mo 1, Di 2, Mi 4, Do 8, Fr 16, Sa 32, So 64)
        at_minute, minutes   wann am Tag (Minuten nach Mitternacht) und wie lange —
                             was man nachschlägt, um hinzugehen
        needed               wie viele Tage es braucht, damit es erfüllt ist (1)
        show_from            ab wann der Mensch es sieht (sonst: ab Beginn)
        report_until         bis wann er Tage eintragen kann (sonst: 7 Tage nach Ende)

    `task_answer`: was der Mensch sagt — accepted, passed, refused.
    `task_day`:    an welchen Tagen er es getan hat (je Tag eine Zeile).

    Erfüllt ist, was mindestens `needed` Tage trägt; das rechnet der Browser
    (bei der Kanzlei und beim Menschen dieselbe Funktion), wie bei den Schritten.
*/

IF COL_LENGTH('app.form_step', 'kind') IS NULL
    ALTER TABLE app.form_step ADD kind nvarchar(10) NOT NULL CONSTRAINT df_form_step_kind DEFAULT (N'mark');
GO

IF COL_LENGTH('app.form_step', 'starts_on') IS NULL
    ALTER TABLE app.form_step ADD
        starts_on    date          NULL,
        ends_on      date          NULL,
        schedule     nvarchar(10)  NULL,
        weekdays     int           NULL,
        at_minute    int           NULL,
        minutes      int           NULL,
        needed       int           NULL,
        show_from    date          NULL,
        report_until date          NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_task CHECK (
        kind = N'mark'
        OR (kind = N'task'
            AND starts_on IS NOT NULL AND ends_on IS NOT NULL AND ends_on >= starts_on
            AND schedule IN (N'any', N'daily', N'weekly')
            AND (schedule <> N'weekly' OR weekdays BETWEEN 1 AND 127)
            AND (at_minute IS NULL OR at_minute BETWEEN 0 AND 1439)
            AND (minutes IS NULL OR minutes BETWEEN 1 AND 1440)
            AND (needed IS NULL OR needed BETWEEN 1 AND 400)
            AND (show_from IS NULL OR show_from <= starts_on)
            AND (report_until IS NULL OR report_until >= ends_on)
            AND done_by = N'person' AND visible_to_person = 1));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_kind' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_kind CHECK (kind IN (N'mark', N'task'));
GO

IF OBJECT_ID('app.task_answer') IS NULL
    CREATE TABLE app.task_answer
    (
        step_id         uniqueidentifier  NOT NULL,
        registration_id uniqueidentifier  NOT NULL,
        answer          nvarchar(10)      NOT NULL,
        answered_at     datetimeoffset(7) NOT NULL,

        /* Der Mensch selbst — oder die Kanzlei für ihn (er hat es ihr gesagt). */
        by_person       bit               NOT NULL,

        CONSTRAINT pk_task_answer PRIMARY KEY (step_id, registration_id),
        CONSTRAINT fk_task_answer_step FOREIGN KEY (step_id) REFERENCES app.form_step (id),
        CONSTRAINT fk_task_answer_registration FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT ck_task_answer CHECK (answer IN (N'accepted', N'passed', N'refused'))
    );
GO

IF OBJECT_ID('app.task_day') IS NULL
    CREATE TABLE app.task_day
    (
        step_id         uniqueidentifier  NOT NULL,
        registration_id uniqueidentifier  NOT NULL,
        day             date              NOT NULL,
        marked_at       datetimeoffset(7) NOT NULL,
        by_person       bit               NOT NULL,

        CONSTRAINT pk_task_day PRIMARY KEY (step_id, registration_id, day),
        CONSTRAINT fk_task_day_step FOREIGN KEY (step_id) REFERENCES app.form_step (id),
        CONSTRAINT fk_task_day_registration FOREIGN KEY (registration_id) REFERENCES app.registration (id)
    );
GO
