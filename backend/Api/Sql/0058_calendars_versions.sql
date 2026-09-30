/*
    KALENDER MIT EIGENEN REGELN, WER DA SEIN MUSS, UND NACHRICHTEN IN FASSUNGEN (0058).

    =========================================================================
    1. MEHR ALS EIN KALENDER JE BEREICH
    =========================================================================

    0054 legte EINEN Terminarz je Bereich fest (`uq_calendar_area`): für den
    Menschen waren es „die Termine dieser Gruppe". Das bleibt der Normalfall —
    er entsteht weiter von selbst und heisst jetzt ausdrücklich so
    (`is_default`). Aber eine Gruppe hat oft mehr als eine Sorte Termine: die
    Messen der Pfarrei und die Sprechstunden des Pfarrers, die Proben und die
    Auftritte. Und ein Mensch will mehr als einen privaten Kalender.

    Deshalb darf ein Bereich mehrere Kalender haben, und jeder sagt als Ganzes,
    wie seine Termine funktionieren — die Vorgaben, die ein einzelner Termin
    übernimmt und ändern kann:

        description        wie die Termine hier gemeint sind, in Worten
        item_kind          was ein Termin hier ist: Treffen, Messe, Beichte, Besuch
        visibility_area_id wer sie sieht (NULL: wer den Bereich des Kalenders hat)
        duration_minutes   wie lange ein Termin normalerweise dauert

    WER DEN KALENDER FÜHRT, bleibt der Bereich (`area_id`): wer dort schreibt,
    trägt ein und ändert.

    =========================================================================
    2. WER RESERVIEREN DARF — AN EINEM TERMIN, NICHT NUR BEIM PFARRER
    =========================================================================

    Bisher war JEDER Termin im Kalender eines Dings (`app.resource`) ein
    Angebot, und nehmen durfte ihn jeder mit dem Link. Die Kandidaten beim
    Priester sind aber nur EIN Fall von etwas Allgemeinem: „dieser Termin ist
    offen für die Leute aus Bereich X".

        resource.reserve_area_id    wer reservieren darf — Mitglieder und
                                    Plätze dieses Bereichs und der Bereiche
                                    darunter; NULL: jeder, der den Termin findet
        resource.bookable_default   sind die Termine des Kalenders von selbst
                                    Angebote? (1 wie bisher)

        calendar_item.bookable        dieser eine Termin: ja / nein / wie der Kalender (NULL)
        calendar_item.capacity        so viele Plätze hat DIESER Termin (NULL: wie das Ding)
        calendar_item.reserve_area_id wer DIESEN Termin reservieren darf (NULL: wie das Ding)

    =========================================================================
    3. WER DA SEIN MUSS
    =========================================================================

    Eine Messe der Pfarrei ist nicht dasselbe wie „meine" Messe: die eine
    feiert Pfarrer A, die andere Vikar B. `app.calendar_presence` heftet einen
    Termin an eine Person (Rolle) — für die ganze Reihe (`occurrence_at` NULL)
    oder für ein einzelnes Vorkommen, das dann die Reihe übersteuert.

    =========================================================================
    4. NACHRICHTEN IN FASSUNGEN
    =========================================================================

    `Kernel.MessageVersionRecord` trägt seit 0052 eine Versionsnummer, und
    jede Fassung wird für sich unterschrieben — nur gab es bisher nur eine.
    Jetzt liegt jede Fassung in `app.chat_message_version`; `chat_message`
    zeigt die jüngste. Bearbeiten heisst: eine neue Fassung, die alte bleibt
    sichtbar (die Geschichte ist Teil der Wahrheit). Löschen heisst: die Zeile
    zeigt keinen Inhalt mehr, aber die Fassungen bleiben — so lässt sich eine
    Nachricht wiederherstellen. Wer sie gelöscht hat, steht dabei, damit das
    Wiederherstellen nicht die Entscheidung dessen aufhebt, der moderiert.
*/

/* -------------------------------------------------------------------------
   1. Kalender
   ------------------------------------------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_calendar_area')
    DROP INDEX uq_calendar_area ON app.calendar;
GO

IF COL_LENGTH('app.calendar', 'is_default') IS NULL
    ALTER TABLE app.calendar ADD is_default bit NOT NULL CONSTRAINT df_calendar_default DEFAULT (0);
GO

IF COL_LENGTH('app.calendar', 'description') IS NULL
    ALTER TABLE app.calendar ADD description nvarchar(1000) NULL;
GO

IF COL_LENGTH('app.calendar', 'item_kind') IS NULL
    ALTER TABLE app.calendar ADD item_kind nvarchar(24) NOT NULL CONSTRAINT df_calendar_item_kind DEFAULT (N'appointment');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_calendar_item_kind')
    ALTER TABLE app.calendar ADD CONSTRAINT ck_calendar_item_kind
        CHECK (item_kind IN (N'appointment', N'mass', N'confession', N'visit'));
GO

IF COL_LENGTH('app.calendar', 'visibility_area_id') IS NULL
    ALTER TABLE app.calendar ADD visibility_area_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_calendar_visibility_area')
    ALTER TABLE app.calendar ADD CONSTRAINT fk_calendar_visibility_area
        FOREIGN KEY (visibility_area_id) REFERENCES app.area (id);
GO

IF COL_LENGTH('app.calendar', 'duration_minutes') IS NULL
    ALTER TABLE app.calendar ADD duration_minutes int NOT NULL CONSTRAINT df_calendar_duration DEFAULT (60);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_calendar_duration')
    ALTER TABLE app.calendar ADD CONSTRAINT ck_calendar_duration CHECK (duration_minutes BETWEEN 5 AND 20160);
GO

IF COL_LENGTH('app.calendar', 'archived_at') IS NULL
    ALTER TABLE app.calendar ADD archived_at datetimeoffset NULL;
GO

/* Der Terminarz, den 0054 je Bereich anlegte, ist dessen Standardkalender — der älteste, falls es je mehr gab. */
WITH firsts AS (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY area_id ORDER BY created_at, id) AS n
    FROM app.calendar
)
UPDATE c SET is_default = 1
FROM app.calendar c JOIN firsts f ON f.id = c.id
WHERE f.n = 1
  AND NOT EXISTS (SELECT 1 FROM app.calendar d WHERE d.area_id = c.area_id AND d.is_default = 1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_calendar_default')
    CREATE UNIQUE INDEX uq_calendar_default ON app.calendar (area_id) WHERE is_default = 1;
GO

/* -------------------------------------------------------------------------
   2. Reservieren: wer, und welche Termine
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.resource', 'reserve_area_id') IS NULL
    ALTER TABLE app.resource ADD reserve_area_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_resource_reserve_area')
    ALTER TABLE app.resource ADD CONSTRAINT fk_resource_reserve_area
        FOREIGN KEY (reserve_area_id) REFERENCES app.area (id);
GO

IF COL_LENGTH('app.resource', 'bookable_default') IS NULL
    ALTER TABLE app.resource ADD bookable_default bit NOT NULL CONSTRAINT df_resource_bookable DEFAULT (1);
GO

IF COL_LENGTH('app.calendar_item', 'bookable') IS NULL
    ALTER TABLE app.calendar_item ADD bookable bit NULL;
GO

IF COL_LENGTH('app.calendar_item', 'capacity') IS NULL
    ALTER TABLE app.calendar_item ADD capacity int NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_capacity')
    ALTER TABLE app.calendar_item ADD CONSTRAINT ck_item_capacity CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 10000);
GO

IF COL_LENGTH('app.calendar_item', 'reserve_area_id') IS NULL
    ALTER TABLE app.calendar_item ADD reserve_area_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_item_reserve_area')
    ALTER TABLE app.calendar_item ADD CONSTRAINT fk_item_reserve_area
        FOREIGN KEY (reserve_area_id) REFERENCES app.area (id);
GO

/* -------------------------------------------------------------------------
   3. Wer da sein muss
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.calendar_presence', 'U') IS NULL
    CREATE TABLE app.calendar_presence
    (
        id            uniqueidentifier NOT NULL,
        item_id       uniqueidentifier NOT NULL,

        /* NULL: die ganze Reihe. Sonst dieses eine Vorkommen — es übersteuert die Reihe. */
        occurrence_at datetimeoffset   NULL,

        role_id       uniqueidentifier NOT NULL,
        duty          nvarchar(16)     NOT NULL CONSTRAINT df_presence_duty DEFAULT (N'present'),
        created_at    datetimeoffset   NOT NULL,

        CONSTRAINT pk_calendar_presence PRIMARY KEY (id),
        CONSTRAINT fk_presence_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id),
        CONSTRAINT fk_presence_role FOREIGN KEY (role_id) REFERENCES app.role (id),
        CONSTRAINT ck_presence_duty CHECK (duty IN (N'present', N'celebrant', N'lead'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_presence')
    CREATE UNIQUE INDEX uq_presence ON app.calendar_presence (item_id, occurrence_at, role_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_presence_role')
    CREATE INDEX ix_presence_role ON app.calendar_presence (role_id) INCLUDE (item_id, occurrence_at);
GO

/* -------------------------------------------------------------------------
   4. Nachrichten in Fassungen
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.chat_message', 'version') IS NULL
    ALTER TABLE app.chat_message ADD version int NOT NULL CONSTRAINT df_chat_message_version DEFAULT (1);
GO

IF COL_LENGTH('app.chat_message', 'edited_at') IS NULL
    ALTER TABLE app.chat_message ADD edited_at datetimeoffset(7) NULL;
GO

IF COL_LENGTH('app.chat_message', 'deleted_by_role_id') IS NULL
    ALTER TABLE app.chat_message ADD deleted_by_role_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.chat_message', 'deleted_by_access_id') IS NULL
    ALTER TABLE app.chat_message ADD deleted_by_access_id uniqueidentifier NULL;
GO

IF OBJECT_ID('app.chat_message_version', 'U') IS NULL
    CREATE TABLE app.chat_message_version
    (
        message_id  uniqueidentifier  NOT NULL,
        version     int               NOT NULL,
        epoch       int               NOT NULL,
        body_sealed varbinary(max)    NOT NULL,
        body_sha256 varbinary(32)     NOT NULL,

        /* Die Unterschrift des Verfassers über MessageVersionRecord mit DIESER Nummer. */
        signature   varbinary(1024)   NOT NULL,
        signed_at   datetimeoffset(7) NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_chat_message_version PRIMARY KEY (message_id, version),
        CONSTRAINT fk_chat_message_version_message FOREIGN KEY (message_id) REFERENCES app.chat_message (id),
        CONSTRAINT ck_chat_message_version_number CHECK (version >= 1)
    );
GO

/* Was schon da ist, ist Fassung 1. Was schon gelöscht war, hat keinen Inhalt mehr — es bleibt gelöscht. */
INSERT INTO app.chat_message_version (message_id, version, epoch, body_sealed, body_sha256, signature, signed_at, created_at)
SELECT m.id, 1, m.epoch, m.body_sealed, m.body_sha256, m.signature, m.signed_at, m.created_at
FROM app.chat_message m
WHERE m.body_sealed IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM app.chat_message_version v WHERE v.message_id = m.id);
GO
