/*
    ZAPROSZENIA (0099) — eine Aufgabe (0098) kann an TERMINEN eines Kalenders
    hängen statt an einem eigenen Plan: „Spotkanie formacyjne" (eine Reihe),
    „Odpust parafialny" (ein Termin), „Różaniec" (das Nabożeństwo aus dem
    Kalender der Pfarrei). Die Tage sind dann die Vorkommen dieses Termins im
    Zeitraum — verschoben, wo er verschoben ist, ohne die abgesagten.

        item_id    welcher Termin (calendar_item; ohne Fremdschlüssel: wird er
                   gelöscht, hat die Aufgabe keine Tage mehr, und das sagt sie)
        presence   VOR jedem Termin fragen: będę / jeszcze nie wiem / nie będę
        done_by    wer die Teilnahme einträgt: der Mensch selbst (person) oder
                   die Kanzlei, nach der Liste (office) — bisher nur person

    `task_duty` — FUNKTIONEN in einem Termin, die wählt, wer kommt: beim Fest
    der Ministranten „Krzyż", „Świece" (2), „Kadzidło" (1). Die Beschriftung
    liegt versiegelt unter dem Schlüssel des Formulars, wie die der Aufgabe;
    `capacity` (offen) sagt, wie viele sie nehmen können (leer: beliebig viele).

    `task_presence` — je Mensch und Tag:
        answer     yes / maybe / no — was er VORHER sagt (oder die Kanzlei für ihn)
        duty_id    die Funktion, die er nimmt (nur mit yes)
        absence    absent / excused — was die Kanzlei NACHHER einträgt, wenn er
                   nicht da war; da gewesen heisst wie bisher: eine Zeile in
                   `task_day` (danach zählt die Aufgabe)
*/

IF COL_LENGTH('app.form_step', 'item_id') IS NULL
    ALTER TABLE app.form_step ADD
        item_id  uniqueidentifier NULL,
        presence bit              NOT NULL CONSTRAINT df_form_step_presence DEFAULT (0);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_task;
GO

ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_task CHECK (
    kind = N'mark'
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

IF OBJECT_ID('app.task_duty') IS NULL
    CREATE TABLE app.task_duty
    (
        id            uniqueidentifier  NOT NULL,
        step_id       uniqueidentifier  NOT NULL,
        position      int               NOT NULL,
        area_id       uniqueidentifier  NOT NULL,
        epoch         int               NOT NULL,
        label_sealed  varbinary(max)    NOT NULL,
        capacity      int               NULL,

        CONSTRAINT pk_task_duty PRIMARY KEY (id),
        CONSTRAINT fk_task_duty_step FOREIGN KEY (step_id) REFERENCES app.form_step (id),
        CONSTRAINT ck_task_duty_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 500)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_task_duty_step')
    CREATE INDEX ix_task_duty_step ON app.task_duty (step_id);
GO

IF OBJECT_ID('app.task_presence') IS NULL
    CREATE TABLE app.task_presence
    (
        step_id         uniqueidentifier  NOT NULL,
        registration_id uniqueidentifier  NOT NULL,
        day             date              NOT NULL,
        answer          nvarchar(10)      NULL,
        duty_id         uniqueidentifier  NULL,
        absence         nvarchar(10)      NULL,
        answered_at     datetimeoffset(7) NOT NULL,

        /* Der Mensch selbst — oder die Kanzlei für ihn. */
        by_person       bit               NOT NULL,

        CONSTRAINT pk_task_presence PRIMARY KEY (step_id, registration_id, day),
        CONSTRAINT fk_task_presence_step FOREIGN KEY (step_id) REFERENCES app.form_step (id),
        CONSTRAINT fk_task_presence_registration FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT fk_task_presence_duty FOREIGN KEY (duty_id) REFERENCES app.task_duty (id),
        CONSTRAINT ck_task_presence_answer CHECK (answer IS NULL OR answer IN (N'yes', N'maybe', N'no')),
        CONSTRAINT ck_task_presence_absence CHECK (absence IS NULL OR absence IN (N'absent', N'excused')),
        CONSTRAINT ck_task_presence_duty CHECK (duty_id IS NULL OR answer = N'yes'),
        CONSTRAINT ck_task_presence_something CHECK (answer IS NOT NULL OR absence IS NOT NULL)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_task_presence_duty')
    CREATE INDEX ix_task_presence_duty ON app.task_presence (step_id, day, duty_id) WHERE duty_id IS NOT NULL;
GO
