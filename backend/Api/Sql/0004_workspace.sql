/*
    Der Arbeitsplatz — was ein Körper hält.

    Alles hier hängt an einem BEREICH, nicht an einem Körper. Deshalb bekommt
    jede Organisation, jede Gruppe und jedes Ereignis Gespräch, Kalender und
    Aufgaben, ohne dass irgendwo etwas eingeschaltet wird: sie besitzen einen
    Bereich, und das genügt.

    Der Kalender weiss nicht, was eine Pfarrei ist. Er weiss, was ein Bereich
    ist — deshalb landen Messen und Scholaproben im selben Tagesblick.
*/

IF OBJECT_ID('app.calendar', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar
    (
        id         uniqueidentifier NOT NULL,
        area_id    uniqueidentifier NOT NULL,

        title      nvarchar(200) NOT NULL,

        -- Die Zone gehört zum Kalender, nicht zum Leser: eine Probe um 18:00
        -- ist um 18:00 dort, wo sie stattfindet.
        time_zone  nvarchar(64) NOT NULL CONSTRAINT df_calendar_zone DEFAULT (N'Europe/Warsaw'),

        created_at datetimeoffset NOT NULL,

        CONSTRAINT pk_calendar PRIMARY KEY (id),
        CONSTRAINT fk_calendar_area FOREIGN KEY (area_id) REFERENCES app.area (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_calendar_area')
    CREATE INDEX ix_calendar_area ON app.calendar (area_id);
GO

/*
    Der Eintrag — Termin, Aufgabe, Messe, Beichte, Besuch in einer Tabelle.
    Eine Messe IST ein Termin mit besonderer Bedeutung, eine Aufgabe einer, den
    man abhaken kann. Getrennte Tabellen hiessen: der Tagesblick müsste fünf
    zusammenfügen und bei jeder neuen Art eine sechste.

    `visibility = 'private'` heisst, dass der Eintrag für andere ganz aus der
    Liste fällt — nicht nur sein Inhalt. Zu zeigen, DASS dort etwas Privates
    steht, wäre schon eine Auskunft über den Tag.
*/
IF OBJECT_ID('app.calendar_item', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar_item
    (
        id              uniqueidentifier NOT NULL,
        calendar_id     uniqueidentifier NOT NULL,
        owner_role_id   uniqueidentifier NOT NULL,

        kind            nvarchar(24) NOT NULL CONSTRAINT df_item_kind DEFAULT (N'appointment'),

        starts_at       datetimeoffset NOT NULL,
        ends_at         datetimeoffset NOT NULL,
        all_day         bit NOT NULL CONSTRAINT df_item_allday DEFAULT (0),

        -- Der Messplan hängt im Schaukasten, die Intention dahinter nicht.
        title_public    nvarchar(200)  NULL,
        title_sealed    varbinary(max) NULL,
        location_sealed varbinary(max) NULL,
        notes_sealed    varbinary(max) NULL,
        epoch           int NULL,

        visibility      nvarchar(16) NOT NULL CONSTRAINT df_item_visibility DEFAULT (N'area'),
        status          nvarchar(16) NOT NULL CONSTRAINT df_item_status DEFAULT (N'planned'),

        -- Nur an Aufgaben.
        task_state      nvarchar(16) NULL,

        -- Das Gespräch, aus dem der Eintrag entstand. Am THEMA und nicht an
        -- einer Nachricht: eine Nachricht kann verborgen werden, ein Thema
        -- bleibt. Ohne den Verweis ist eine Aufgabe drei Worte ohne
        -- Zusammenhang.
        topic_id        uniqueidentifier NULL,

        repeat_kind     nvarchar(16) NOT NULL CONSTRAINT df_item_repeat DEFAULT (N'none'),
        repeat_every    int NOT NULL CONSTRAINT df_item_every DEFAULT (1),
        repeat_weekdays tinyint NULL,
        repeat_until    datetimeoffset NULL,
        repeat_count    int NULL,

        created_at      datetimeoffset NOT NULL,
        updated_at      datetimeoffset NOT NULL,

        CONSTRAINT pk_calendar_item PRIMARY KEY (id),
        CONSTRAINT fk_calendar_item_calendar FOREIGN KEY (calendar_id) REFERENCES app.calendar (id),

        CONSTRAINT ck_item_kind
            CHECK (kind IN (N'appointment', N'task', N'mass', N'confession', N'visit')),
        CONSTRAINT ck_item_visibility
            CHECK (visibility IN (N'private', N'area', N'public')),
        CONSTRAINT ck_item_status
            CHECK (status IN (N'planned', N'confirmed', N'cancelled')),
        CONSTRAINT ck_item_task
            CHECK (task_state IS NULL OR task_state IN (N'todo', N'doing', N'done', N'cancelled')),
        CONSTRAINT ck_item_repeat
            CHECK (repeat_kind IN (N'none', N'daily', N'weekly', N'monthly', N'yearly')),

        CONSTRAINT ck_item_span CHECK (ends_at >= starts_at),

        -- Eine Wiederholung ohne Ende liesse sich nicht ausrechnen, nur
        -- abschneiden — und jede Ansicht schnitte woanders ab.
        CONSTRAINT ck_item_repeat_end
            CHECK (repeat_kind = N'none' OR repeat_until IS NOT NULL OR repeat_count IS NOT NULL),

        CONSTRAINT ck_item_epoch
            CHECK ((title_sealed IS NULL AND location_sealed IS NULL AND notes_sealed IS NULL)
                OR epoch IS NOT NULL)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_window')
    CREATE INDEX ix_item_window ON app.calendar_item (calendar_id, starts_at) INCLUDE (ends_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_topic')
    CREATE INDEX ix_item_topic ON app.calendar_item (topic_id) WHERE topic_id IS NOT NULL;
GO

/*
    Eine Ausnahme in einer Reihe: abgesagt oder verschoben.

    `original_start` ist der Name des Vorkommens in der Reihe. Er bleibt auch
    nach einer Verschiebung stehen — ohne ihn liesse sie sich nie aufheben.
*/
IF OBJECT_ID('app.calendar_exception', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar_exception
    (
        item_id        uniqueidentifier NOT NULL,
        original_start datetimeoffset   NOT NULL,

        cancelled      bit NOT NULL CONSTRAINT df_exception_cancelled DEFAULT (0),
        moved_to       datetimeoffset NULL,

        created_at     datetimeoffset NOT NULL,

        CONSTRAINT pk_calendar_exception PRIMARY KEY (item_id, original_start),
        CONSTRAINT fk_calendar_exception_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id)
    );
END
GO

/*
    Die Nachricht. `epoch` steht an ihr, weil ein Schnitt sie nicht unlesbar
    machen darf: wer damals dabei war, liest sie weiter.

    `hidden_at` statt DELETE — eine verschwundene Nachricht mitten in einem
    Gespräch lässt die übrigen unverständlich.
*/
IF OBJECT_ID('app.message', 'U') IS NULL
BEGIN
    CREATE TABLE app.message
    (
        id               uniqueidentifier NOT NULL,
        area_id          uniqueidentifier NOT NULL,
        author_role_id   uniqueidentifier NOT NULL,

        epoch            int            NOT NULL,
        body_sealed      varbinary(max) NOT NULL,

        created_at       datetimeoffset NOT NULL,
        edited_at        datetimeoffset NULL,
        hidden_at        datetimeoffset NULL,
        hidden_by_author bit NOT NULL CONSTRAINT df_message_hidden_by DEFAULT (0),

        CONSTRAINT pk_message PRIMARY KEY (id),
        CONSTRAINT fk_message_area FOREIGN KEY (area_id) REFERENCES app.area (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_message_area')
    CREATE INDEX ix_message_area ON app.message (area_id, created_at DESC);
GO

/*
    Das Thema — Ordnung, die nachträglich entsteht.

    Ein Kanal verlangt die Entscheidung vorher: wohin gehört das, was ich
    gleich schreibe? Wer das nicht weiss, schreibt es irgendwohin. Ein Thema
    wird gebildet, wenn sich zeigt, dass eines da ist.

    Deshalb ist die Zuordnung eine eigene Tabelle: eine Nachricht kann zu
    mehreren Themen gehören und muss zu keinem.
*/
IF OBJECT_ID('app.topic', 'U') IS NULL
BEGIN
    CREATE TABLE app.topic
    (
        id              uniqueidentifier NOT NULL,
        area_id         uniqueidentifier NOT NULL,

        title_sealed    varbinary(max) NOT NULL,
        epoch           int            NOT NULL,

        parent_topic_id uniqueidentifier NULL,

        -- Zwei Zustände, mehr nicht. Jeder weitere erzeugt Diskussionen
        -- darüber, was er bedeutet, und niemand pflegt ihn.
        closed_at       datetimeoffset NULL,
        created_at      datetimeoffset NOT NULL,

        CONSTRAINT pk_topic PRIMARY KEY (id),
        CONSTRAINT fk_topic_area   FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_topic_parent FOREIGN KEY (parent_topic_id) REFERENCES app.topic (id)
    );
END
GO

IF OBJECT_ID('app.topic_message', 'U') IS NULL
BEGIN
    CREATE TABLE app.topic_message
    (
        topic_id            uniqueidentifier NOT NULL,
        message_id          uniqueidentifier NOT NULL,
        assigned_by_role_id uniqueidentifier NOT NULL,
        created_at          datetimeoffset NOT NULL,

        CONSTRAINT pk_topic_message PRIMARY KEY (topic_id, message_id),
        CONSTRAINT fk_topic_message_topic   FOREIGN KEY (topic_id)   REFERENCES app.topic (id),
        CONSTRAINT fk_topic_message_message FOREIGN KEY (message_id) REFERENCES app.message (id)
    );
END
GO

/*
    Der Anhang — keine Bytes in der Zeile.

    Im Altbestand lagen 105 Fotos als varbinary(max) in einer Tabelle: 61 MB,
    die Hälfte einer Datendatei mit harter 250-MB-Grenze. Ist die erreicht,
    scheitert nicht der Upload, sondern jedes Schreiben — Anmeldung,
    Messintention, Sitzung. Daneben lag der Plattenplatz leer.

    `content_path` ist relativ zum Ablageordner: ein absoluter Pfad stünde in
    tausend Zeilen und müsste beim Serverwechsel in tausend geändert werden.
*/
IF OBJECT_ID('app.attachment', 'U') IS NULL
BEGIN
    CREATE TABLE app.attachment
    (
        id               uniqueidentifier NOT NULL,
        area_id          uniqueidentifier NOT NULL,

        owner_kind       nvarchar(24)     NOT NULL,
        owner_id         uniqueidentifier NOT NULL,

        file_name_sealed varbinary(max) NOT NULL,
        epoch            int NOT NULL,

        content_path     nvarchar(400) NOT NULL,
        content_sha256   varbinary(32) NOT NULL,
        size_bytes       bigint        NOT NULL,
        content_type     nvarchar(80)  NOT NULL,

        created_at       datetimeoffset NOT NULL,

        CONSTRAINT pk_attachment PRIMARY KEY (id),
        CONSTRAINT fk_attachment_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_attachment_size CHECK (size_bytes >= 0)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_attachment_owner')
    CREATE INDEX ix_attachment_owner ON app.attachment (owner_kind, owner_id);
GO
