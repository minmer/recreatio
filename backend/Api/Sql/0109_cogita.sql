/*
    COGITA (0109) — was der Neubau von Cogita im Dienst braucht (COGITA.md).

    Alles Inhaltliche liegt weiter in der Bibliothek (0064): Arten, Einträge,
    Vorlagen, Wiederholungen, Abläufe — versiegelt, ein Dokument je Eintrag.
    Hier kommt nur hinzu, was dort keinen Platz hat:

        library_entry_version   die früheren Fassungen eines Eintrags [N9]
        library_file            versiegelte Dateien einer Bibliothek: Erzählton, Bilder, Filme [G10]
        learn_batch             die Antworten eines Lernenden, versiegelt — für ihn und für die
                                Annahme des erklärten Bereichs, genau wie ein Formular sein Amt
                                erreicht [E10, F16]
        learn_due               wann der Lernende wieder dran ist — das Einzige, was offen liegt [E8]
        cogita_session(*)       Sitzungen: live, asynchron, an einem Gerät, Erzählung, Spiel [I2]
        cogita_game_*           was der Dienst während eines Spiels lesen darf [J2] — und nur dann
        form_step  learn        der Schritt „Naucz się" [L5]
        slug  c                 die Wurzel der Adressen, unter denen ein Baustein direkt erscheint [F20]
*/

/* -- 1. Fassungen ------------------------------------------------------------------ */

IF COL_LENGTH('app.library_entry', 'written_by_account_id') IS NULL
    ALTER TABLE app.library_entry ADD written_by_account_id uniqueidentifier NULL;
GO

IF OBJECT_ID('app.library_entry_version', 'U') IS NULL
    CREATE TABLE app.library_entry_version
    (
        entry_id              uniqueidentifier  NOT NULL,
        version               int               NOT NULL,
        kind                  nvarchar(32)      NOT NULL,
        epoch                 int               NOT NULL,
        sealed                varbinary(max)    NOT NULL,
        written_at            datetimeoffset(7) NOT NULL,
        written_by_account_id uniqueidentifier  NULL,
        CONSTRAINT pk_library_entry_version PRIMARY KEY (entry_id, version),
        CONSTRAINT fk_library_entry_version_entry FOREIGN KEY (entry_id) REFERENCES app.library_entry (id)
    );
GO

/* -- 2. Dateien ----------------------------------------------------------------------- */

IF OBJECT_ID('app.library_file', 'U') IS NULL
    CREATE TABLE app.library_file
    (
        id          uniqueidentifier  NOT NULL,
        library_id  uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        /* Die Hülle liegt als Datei neben den Anhängen der Rozmowy (Cogita:FileDirectory), hier nur, was zu ihr gehört. */
        size        int               NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        /*
            Eine OFFENE Fassung daneben, wenn ein veröffentlichter Ablauf oder
            Eintrag die Datei zeigt (ein öffentlicher Kurs hat keinen Schlüssel).
            Sie wird ausdrücklich hinausgestellt und wieder zurückgezogen.
        */
        public_size int               NULL,
        public_type nvarchar(100)     NULL,
        public_at   datetimeoffset(7) NULL,
        CONSTRAINT pk_library_file PRIMARY KEY (id),
        CONSTRAINT fk_library_file_library FOREIGN KEY (library_id) REFERENCES app.library (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_file_library')
    CREATE INDEX ix_library_file_library ON app.library_file (library_id);
GO

/* -- 3. Antworten ------------------------------------------------------------------------ */

/*
    EIN STAPEL ANTWORTEN (oder Kenntnisse, eine Stelle im Ablauf, Werte, gesperrte
    Karten, Hinweise an die Autoren). Versiegelt mit einem Zufallsschlüssel; der
    liegt zweimal da: für den Lernenden (seine Person, RSA — oder sein Platz,
    P-256) und für die Annahme des Bereichs, in dem die Antworten liegen sollen
    (RSA, wie bei einem Formular). Der Dienst sieht: wer, wohin, wann, wie viel.

    `flags` und `counts` gehen an die Autoren und tragen keinen Halter: sie sind
    anonym [K4].
*/
IF OBJECT_ID('app.learn_batch', 'U') IS NULL
    CREATE TABLE app.learn_batch
    (
        id                uniqueidentifier  NOT NULL,
        library_id        uniqueidentifier  NOT NULL,
        area_id           uniqueidentifier  NOT NULL,
        holder_role_id    uniqueidentifier  NULL,
        holder_access_id  uniqueidentifier  NULL,
        kind              nvarchar(16)      NOT NULL,
        sealed            varbinary(max)    NOT NULL,
        key_for_holder    varbinary(max)    NULL,
        key_for_area      varbinary(max)    NULL,
        created_at        datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_learn_batch PRIMARY KEY (id),
        CONSTRAINT fk_learn_batch_library FOREIGN KEY (library_id) REFERENCES app.library (id),
        CONSTRAINT fk_learn_batch_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_learn_batch_role FOREIGN KEY (holder_role_id) REFERENCES app.role (id),
        CONSTRAINT fk_learn_batch_access FOREIGN KEY (holder_access_id) REFERENCES app.access (id),
        CONSTRAINT ck_learn_batch_kind CHECK (kind IN (N'answers', N'snapshots', N'position', N'values', N'suspend', N'flags', N'counts')),
        CONSTRAINT ck_learn_batch_holder CHECK (
            (kind IN (N'flags', N'counts') AND holder_role_id IS NULL AND holder_access_id IS NULL AND key_for_holder IS NULL)
            OR (kind NOT IN (N'flags', N'counts') AND (CASE WHEN holder_role_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN holder_access_id IS NULL THEN 0 ELSE 1 END) = 1))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_learn_batch_role')
    CREATE INDEX ix_learn_batch_role ON app.learn_batch (holder_role_id, library_id, created_at) WHERE holder_role_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_learn_batch_access')
    CREATE INDEX ix_learn_batch_access ON app.learn_batch (holder_access_id, library_id, created_at) WHERE holder_access_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_learn_batch_area')
    CREATE INDEX ix_learn_batch_area ON app.learn_batch (area_id, library_id, created_at);
GO

/* Wann wieder dran — offen, damit eine Erinnerung ohne Schlüssel kommen kann. Sonst nichts. */
IF OBJECT_ID('app.learn_due', 'U') IS NULL
    CREATE TABLE app.learn_due
    (
        id                uniqueidentifier  NOT NULL,
        holder_role_id    uniqueidentifier  NULL,
        holder_access_id  uniqueidentifier  NULL,
        library_id        uniqueidentifier  NOT NULL,
        due_at            datetimeoffset(7) NULL,
        due_count         int               NOT NULL CONSTRAINT df_learn_due_count DEFAULT (0),
        updated_at        datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_learn_due PRIMARY KEY (id),
        CONSTRAINT fk_learn_due_library FOREIGN KEY (library_id) REFERENCES app.library (id),
        CONSTRAINT fk_learn_due_role FOREIGN KEY (holder_role_id) REFERENCES app.role (id),
        CONSTRAINT fk_learn_due_access FOREIGN KEY (holder_access_id) REFERENCES app.access (id),
        CONSTRAINT ck_learn_due_holder CHECK ((CASE WHEN holder_role_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN holder_access_id IS NULL THEN 0 ELSE 1 END) = 1)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_learn_due_role')
    CREATE UNIQUE INDEX uq_learn_due_role ON app.learn_due (holder_role_id, library_id) WHERE holder_role_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_learn_due_access')
    CREATE UNIQUE INDEX uq_learn_due_access ON app.learn_due (holder_access_id, library_id) WHERE holder_access_id IS NOT NULL;
GO

/* -- 4. Sitzungen ---------------------------------------------------------------------- */

/*
    EINE SITZUNG ist ein Strom von Ereignissen in einem Bereich — ein eigener
    Kern neben dem Chat, der dessen Stücke teilt: der Schlüssel kommt aus der
    Epoche des Bereichs, Plätze bekommen ihn über ihre P-256-Identität
    (`cogita_session_key`), Linkpersonen sprechen als ihr Platz.

    `plain` trägt nur, was der Dienst lesen muss: im Spiel die Daten, an denen
    er die Auslöser prüft [J2]. Alles andere ist `sealed`.
*/
IF OBJECT_ID('app.cogita_session', 'U') IS NULL
    CREATE TABLE app.cogita_session
    (
        id             uniqueidentifier  NOT NULL,
        area_id        uniqueidentifier  NOT NULL,
        library_id     uniqueidentifier  NULL,
        kind           nvarchar(16)      NOT NULL,
        state          nvarchar(16)      NOT NULL,
        epoch          int               NOT NULL,
        title_sealed   varbinary(4096)   NULL,
        host_role_id   uniqueidentifier  NOT NULL,
        page_path      nvarchar(400)     NULL,
        /*
            Wer ohne Konto und ohne Platz mitmacht (ein Quiz beim Pfarrfest):
            der Link trägt ein Geheimnis, von dem hier nur der Hash liegt, und —
            hinter der Raute, nie beim Dienst — den Sitzungsschlüssel. Der Code
            zum Eintippen gibt nur das Mitmachen, keinen Schlüssel: das Telefon
            zeigt dann die Knöpfe, die Fragen stehen auf der Leinwand.
        */
        join_sha256    varbinary(32)     NULL,
        join_code      nvarchar(8)       NULL,
        /* Bis wann eine Sitzung ohne festen Takt (asynchron, eine Erzählung) Antworten nimmt. */
        ends_at        datetimeoffset(7) NULL,
        created_at     datetimeoffset(7) NOT NULL,
        updated_at     datetimeoffset(7) NOT NULL,
        started_at     datetimeoffset(7) NULL,
        closed_at      datetimeoffset(7) NULL,
        CONSTRAINT pk_cogita_session PRIMARY KEY (id),
        CONSTRAINT fk_cogita_session_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_cogita_session_library FOREIGN KEY (library_id) REFERENCES app.library (id),
        CONSTRAINT fk_cogita_session_host FOREIGN KEY (host_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_cogita_session_kind CHECK (kind IN (N'live', N'async', N'sync', N'story', N'game', N'shared')),
        CONSTRAINT ck_cogita_session_state CHECK (state IN (N'lobby', N'running', N'paused', N'finished', N'closed'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cogita_session_area')
    CREATE INDEX ix_cogita_session_area ON app.cogita_session (area_id, updated_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_cogita_session_code')
    CREATE UNIQUE INDEX uq_cogita_session_code ON app.cogita_session (join_code) WHERE join_code IS NOT NULL;
GO

IF OBJECT_ID('app.cogita_session_event', 'U') IS NULL
    CREATE TABLE app.cogita_session_event
    (
        session_id        uniqueidentifier  NOT NULL,
        seq               int               NOT NULL,
        id                uniqueidentifier  NOT NULL,
        kind              nvarchar(16)      NOT NULL,
        author_role_id    uniqueidentifier  NULL,
        author_person_id  uniqueidentifier  NULL,
        author_access_id  uniqueidentifier  NULL,
        epoch             int               NOT NULL,
        sealed            varbinary(max)    NULL,
        plain             nvarchar(max)     NULL,
        created_at        datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_cogita_session_event PRIMARY KEY (session_id, seq),
        CONSTRAINT fk_cogita_session_event_session FOREIGN KEY (session_id) REFERENCES app.cogita_session (id),
        CONSTRAINT ck_cogita_session_event_kind CHECK (LEN(kind) BETWEEN 2 AND 16 AND kind NOT LIKE N'%[^a-z0-9_-]%'),
        CONSTRAINT ck_cogita_session_event_body CHECK (sealed IS NOT NULL OR plain IS NOT NULL)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_cogita_session_event_id')
    CREATE UNIQUE INDEX uq_cogita_session_event_id ON app.cogita_session_event (id);
GO

IF OBJECT_ID('app.cogita_session_key', 'U') IS NULL
    CREATE TABLE app.cogita_session_key
    (
        session_id         uniqueidentifier  NOT NULL,
        access_id          uniqueidentifier  NOT NULL,
        epoch              int               NOT NULL,
        key_sealed         varbinary(max)    NOT NULL,
        sealed_by_role_id  uniqueidentifier  NULL,
        sealed_at          datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_cogita_session_key PRIMARY KEY (session_id, access_id, epoch),
        CONSTRAINT fk_cogita_session_key_session FOREIGN KEY (session_id) REFERENCES app.cogita_session (id),
        CONSTRAINT fk_cogita_session_key_access FOREIGN KEY (access_id) REFERENCES app.access (id)
    );
GO

/* -- 5. Spiel ---------------------------------------------------------------------------- */

/*
    WAS DER DIENST WÄHREND EINES SPIELS LESEN DARF [J2, J3]: die Zonen und
    Auslöser des Spiels, die Werte, die Positionen. Endet das Spiel, werden die
    Positionen gelöscht; niemand ausser dem Gastgeber sieht sie.
*/
IF OBJECT_ID('app.cogita_game_state', 'U') IS NULL
    CREATE TABLE app.cogita_game_state
    (
        session_id  uniqueidentifier  NOT NULL,
        /* Zonen, Auslöser, Werte — was der Gastgeber beim Start offenlegt; {zones, triggers, values}. */
        rules_json  nvarchar(max)     NOT NULL,
        /* Der Stand: Werte je Spieler und Team, Kassenbuch, betretene Zonen, letzter Takt. */
        state_json  nvarchar(max)     NOT NULL,
        updated_at  datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_cogita_game_state PRIMARY KEY (session_id),
        CONSTRAINT fk_cogita_game_state_session FOREIGN KEY (session_id) REFERENCES app.cogita_session (id)
    );
GO

IF OBJECT_ID('app.cogita_game_position', 'U') IS NULL
    CREATE TABLE app.cogita_game_position
    (
        session_id  uniqueidentifier  NOT NULL,
        player      nvarchar(80)      NOT NULL,
        team        nvarchar(80)      NULL,
        lat         float             NOT NULL,
        lon         float             NOT NULL,
        accuracy    float             NULL,
        at          datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_cogita_game_position PRIMARY KEY (session_id, player),
        CONSTRAINT fk_cogita_game_position_session FOREIGN KEY (session_id) REFERENCES app.cogita_session (id)
    );
GO

/* -- 6. Der Schritt „Naucz się" -------------------------------------------------------------- */

IF COL_LENGTH('app.form_step', 'learn_library_id') IS NULL
    ALTER TABLE app.form_step ADD learn_library_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.form_step', 'learn_revision_id') IS NULL
    ALTER TABLE app.form_step ADD learn_revision_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.form_step', 'learn_threshold') IS NULL
    ALTER TABLE app.form_step ADD learn_threshold float NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_kind' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_kind;
GO

ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_kind CHECK (kind IN (N'mark', N'task', N'booking', N'chat', N'learn'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_form_step_task' AND parent_object_id = OBJECT_ID('app.form_step'))
    ALTER TABLE app.form_step DROP CONSTRAINT ck_form_step_task;
GO

ALTER TABLE app.form_step ADD CONSTRAINT ck_form_step_task CHECK (
    kind = N'mark'
    OR (kind = N'booking' AND resource_id IS NOT NULL AND done_by = N'person' AND visible_to_person = 1)
    OR (kind = N'chat' AND chat_kind IN (N'all', N'seat', N'area', N'channel') AND done_by = N'person' AND visible_to_person = 1)
    OR (kind = N'learn' AND learn_library_id IS NOT NULL AND learn_threshold BETWEEN 0 AND 1 AND done_by = N'person' AND visible_to_person = 1)
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

/* -- 7. Die Wurzel `c` -------------------------------------------------------------------- */

/*
    Unter `c/<kennung>` erscheint ein Baustein direkt — ein Formular, eine
    Wiederholung, ein Ablauf —, ohne dass jemand eine Seite baut. Die Wurzel
    selbst führt niemand: ihr Code ist zufällig und wurde nie ausgegeben; die
    Adressen darunter legt der Dienst an und gibt sie dem, der veröffentlicht.
*/
IF NOT EXISTS (SELECT 1 FROM app.slug WHERE path = N'c')
BEGIN
    INSERT INTO app.slug (id, path, claim_code_sha256, note, created_at)
    VALUES (NEWID(), N'c', CRYPT_GEN_RANDOM(32), N'c. Root of directly published modules; its code was never issued.', SYSDATETIMEOFFSET());
END
GO
