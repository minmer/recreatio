/*
    Der Körper — Organisation, Gruppe und Ereignis sind eine Sache.

    Der Altbestand hatte dafür sieben Tabellen mit fast gleichen Spalten. Was
    sie wirklich unterschied:

        Gruppe        nichts — sie ist der Grundfall
        Organisation  verantwortlich für die Daten, darf andere enthalten
        Ereignis      hat einen Anfang und ein Ende

    Also ein `app.body` und zwei kleine Tabellen daneben. Eine achte Art ist
    damit geschenkt.

    Amt und Mitgliedschaft sind zwei Rollen, keine zwei Stufen einer: wer die
    Schola führt, ändert ihren Aushang; wer dazugehört, redet mit.
*/

IF OBJECT_ID('app.body', 'U') IS NULL
BEGIN
    CREATE TABLE app.body
    (
        id             uniqueidentifier NOT NULL,
        kind           nvarchar(16)     NOT NULL,

        area_id        uniqueidentifier NOT NULL,
        office_role_id uniqueidentifier NOT NULL,
        member_role_id uniqueidentifier NOT NULL,

        -- Die Heimat. NULL heisst: hängt an nichts. Dieselbe Spalte für
        -- Ereignis-in-Gruppe, Gruppe-in-Organisation, Organisation-in-Verband,
        -- weil es dieselbe Beziehung ist.
        parent_body_id uniqueidentifier NULL,

        -- Der Aushang: Klartext, weil ohne Konto ausgeliefert.
        slug           nvarchar(80)  NOT NULL,
        name           nvarchar(200) NOT NULL,
        summary        nvarchar(400) NULL,
        meets          nvarchar(200) NULL,

        -- 0 heisst nicht „geheim" (der Inhalt ist ohnehin versiegelt), sondern
        -- „wird nicht angekündigt".
        is_public      bit NOT NULL CONSTRAINT df_body_public DEFAULT (1),

        -- Das Innere: unter dem Epochenschlüssel des Bereichs.
        note_sealed    varbinary(max) NULL,
        note_epoch     int            NULL,

        lifecycle      nvarchar(16) NOT NULL CONSTRAINT df_body_lifecycle DEFAULT (N'active'),
        created_at     datetimeoffset NOT NULL,

        CONSTRAINT pk_body PRIMARY KEY (id),

        CONSTRAINT fk_body_area   FOREIGN KEY (area_id)        REFERENCES app.area (id),
        CONSTRAINT fk_body_office FOREIGN KEY (office_role_id) REFERENCES app.role (id),
        CONSTRAINT fk_body_member FOREIGN KEY (member_role_id) REFERENCES app.role (id),
        CONSTRAINT fk_body_parent FOREIGN KEY (parent_body_id) REFERENCES app.body (id),

        CONSTRAINT ck_body_kind CHECK (kind IN (N'organisation', N'group', N'event')),
        CONSTRAINT ck_body_lifecycle CHECK (lifecycle IN (N'draft', N'active', N'archived')),

        -- Eine Notiz ohne ihre Epoche wäre unlesbar und sähe leer aus.
        CONSTRAINT ck_body_note
            CHECK ((note_sealed IS NULL AND note_epoch IS NULL)
                OR (note_sealed IS NOT NULL AND note_epoch IS NOT NULL)),

        CONSTRAINT ck_body_parent CHECK (parent_body_id IS NULL OR parent_body_id <> id)
    );
END
GO

/*
    Ein Bereich trägt höchstens einen Körper. Zwei hätten dasselbe Gespräch und
    dieselben Mitglieder — also denselben Körper unter zwei Namen, aber mit zwei
    Beitrittslinks, von denen einer in den falschen führt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_body_area')
    CREATE UNIQUE INDEX ux_body_area ON app.body (area_id);
GO

/*
    Die Adresse ist eindeutig unter der Heimat, nicht plattformweit: zwei
    Pfarreien dürfen beide eine `schola` haben. Auf oberster Ebene ist
    `parent_body_id` NULL, und der Index behandelt NULL wie jeden Wert.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_body_slug')
    CREATE UNIQUE INDEX ux_body_slug ON app.body (parent_body_id, slug);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_body_parent')
    CREATE INDEX ix_body_parent ON app.body (parent_body_id) WHERE parent_body_id IS NOT NULL;
GO

/*
    Die Organisation: der einzige echte Unterschied ist, dass sie
    verantwortlich ist. Jedes Formular, das personenbezogene Daten sammelt,
    muss sagen, wer sie verarbeitet und unter welcher Anschrift.

    Klartext notwendigerweise — die Klausel steht unter dem Formular, bevor
    jemand etwas eingegeben hat. Sie zu verschlüsseln hiesse, sie dem
    vorzuenthalten, für den sie da ist.

    Eine Gruppe hat keine solche Zeile; deshalb braucht jede eine Organisation
    über sich, und sei es die des Hauses.
*/
IF OBJECT_ID('app.organisation', 'U') IS NULL
BEGIN
    CREATE TABLE app.organisation
    (
        body_id            uniqueidentifier NOT NULL,

        controller_name    nvarchar(200) NOT NULL,
        controller_address nvarchar(400) NULL,
        controller_email   nvarchar(200) NULL,

        -- Farben und Anordnung, kein Inhalt.
        theme              nvarchar(max) NULL,

        CONSTRAINT pk_organisation PRIMARY KEY (body_id),
        CONSTRAINT fk_organisation_body FOREIGN KEY (body_id) REFERENCES app.body (id)
    );
END
GO

/*
    Das Ereignis: ein Anfang und ein Ende, mehr nicht.

    Es braucht keine Sammlung über sich — der Altbestand verlangte
    `collection_id NOT NULL`. Es hängt an dem Körper, dem es gehört, oder an
    nichts.
*/
IF OBJECT_ID('app.event', 'U') IS NULL
BEGIN
    CREATE TABLE app.event
    (
        body_id    uniqueidentifier NOT NULL,

        starts_at  datetimeoffset NULL,
        ends_at    datetimeoffset NULL,

        -- „ostatni weekend sierpnia", wenn das Datum noch nicht feststeht.
        date_label nvarchar(120) NULL,

        place      nvarchar(200) NULL,
        category   nvarchar(120) NULL,

        CONSTRAINT pk_event PRIMARY KEY (body_id),
        CONSTRAINT fk_event_body FOREIGN KEY (body_id) REFERENCES app.body (id),
        CONSTRAINT ck_event_span
            CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_event_when')
    CREATE INDEX ix_event_when ON app.event (starts_at) WHERE starts_at IS NOT NULL;
GO

/*
    Die zweite Zugehörigkeit: die Oase in der Pfarrei gehört auch zur
    überpfarrlichen Bewegung.

    `parent_body_id` ist die Heimat und besitzt die Adresse; diese Tabelle ist
    alles Weitere. Aufführen heisst NICHT lesen — eine Zeile hier gibt keinen
    Schlüssel. Wer hineinsehen soll, bekommt eine Zuteilung (`key_grant`, Art
    `shared_view`), und die ist eine eigene, sichtbare Entscheidung.
*/
IF OBJECT_ID('app.body_listing', 'U') IS NULL
BEGIN
    CREATE TABLE app.body_listing
    (
        id              uniqueidentifier NOT NULL,
        body_id         uniqueidentifier NOT NULL,
        organisation_id uniqueidentifier NOT NULL,
        created_at      datetimeoffset   NOT NULL,

        CONSTRAINT pk_body_listing PRIMARY KEY (id),
        CONSTRAINT fk_body_listing_body FOREIGN KEY (body_id) REFERENCES app.body (id),
        CONSTRAINT fk_body_listing_org  FOREIGN KEY (organisation_id) REFERENCES app.organisation (body_id),
        CONSTRAINT ck_body_listing_self CHECK (body_id <> organisation_id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_body_listing_pair')
    CREATE UNIQUE INDEX ux_body_listing_pair ON app.body_listing (organisation_id, body_id);
GO
