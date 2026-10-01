/*
    AUFGABEN MIT ZEITRAUM, ERINNERUNGEN UND HERKUNFT (0066).

    =========================================================================
    1. EIN ZEITRAUM, DER WIEDERKOMMT — `period`
    =========================================================================

    Neben `window` (ein Fenster nach dem Kalender: täglich, wöchentlich, …)
    und `after` (ein Abstand nach dem letzten Erledigen) eine dritte Art:

        period   ein Zeitraum von `window_minutes`, der alle `every_minutes`
                 neu beginnt — „die Kirche putzen: drei Tage Zeit, alle zwei
                 Wochen". Die Aufgabe kommt nicht in einem Augenblick, sondern
                 steht ab Beginn da und wird dringender, bis der Zeitraum endet.

    Ein Zeitraum darf wie ein Fenster bis zu einem Jahr (527040 Minuten, 0055) dauern.

    =========================================================================
    2. ERINNERUNGEN — am Anfang, in der Mitte, am Ende
    =========================================================================

    `remind_mask`: 1 Anfang, 2 Mitte, 4 Ende. Die Zeitpunkte rechnet der Dienst
    aus den Vorkommen; der Browser (und die App, auch geschlossen) erinnert.

    =========================================================================
    3. WOHER — aus einer Rozmowa
    =========================================================================

    Eine Aufgabe, die aus einer Nachricht entstand, weiss, aus welcher
    Rozmowa, welchem Thema und welcher Nachricht — ohne den Verweis wäre sie
    drei Worte ohne Zusammenhang.

    Ohne Fremdschlüssel, wie `calendar_item.topic_id` (0004): eine Rozmowa
    kann mit ihrem Bereich gehen, die Aufgabe bleibt — dann zeigt der Verweis
    ins Leere, und die Oberfläche sagt „rozmowa już nie istnieje".
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_kind')
    ALTER TABLE app.task DROP CONSTRAINT ck_task_kind;
GO
ALTER TABLE app.task ADD CONSTRAINT ck_task_kind CHECK (kind IN (N'window', N'after', N'period'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_shape')
    ALTER TABLE app.task DROP CONSTRAINT ck_task_shape;
GO
ALTER TABLE app.task ADD CONSTRAINT ck_task_shape CHECK (
    (kind = N'window' AND every_minutes IS NULL)
 OR (kind = N'after' AND every_minutes IS NOT NULL AND every_minutes > 0 AND repeat_kind = N'none')
 OR (kind = N'period' AND every_minutes IS NOT NULL AND every_minutes >= window_minutes AND window_minutes > 0 AND repeat_kind = N'none'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_window')
    ALTER TABLE app.task DROP CONSTRAINT ck_task_window;
GO
ALTER TABLE app.task ADD CONSTRAINT ck_task_window CHECK (window_minutes BETWEEN 0 AND 527040);
GO

IF COL_LENGTH('app.task', 'remind_mask') IS NULL
    ALTER TABLE app.task ADD remind_mask tinyint NOT NULL CONSTRAINT df_task_remind DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_task_remind')
    ALTER TABLE app.task ADD CONSTRAINT ck_task_remind CHECK (remind_mask BETWEEN 0 AND 7);
GO

IF COL_LENGTH('app.task', 'chat_id') IS NULL
    ALTER TABLE app.task ADD chat_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.task', 'topic_id') IS NULL
    ALTER TABLE app.task ADD topic_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.task', 'message_id') IS NULL
    ALTER TABLE app.task ADD message_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_task_chat')
    CREATE INDEX ix_task_chat ON app.task (chat_id, topic_id) WHERE chat_id IS NOT NULL;
GO
