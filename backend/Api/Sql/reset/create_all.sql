/*
    DAS GANZE SCHEMA, IN EINEM STUECK.

    -------------------------------------------------------------------------
    WAS DAS IST
    -------------------------------------------------------------------------

    Der ENDZUSTAND der Wanderungen 0001 bis 0019 — nicht ihr Nacheinander.
    Wo eine spaetere eine fruehere geaendert hat, steht hier nur das Ergebnis:

        ck_role_kind          `person, role, group`   (0011, nicht 0001)
        ck_certificate_scope  mit `slug`              (0012)
        claim_code_sha256     NULL erlaubt            (0012)
        ck_slug_path          laesst die leere Wurzel (0014)
        role_edge             mit edge_kind, expires_at (0008)
        area                  mit name                (0019)
        area_epoch            mit key_public          (0019)

    Wer diese Datei liest, sieht das Haus, wie es steht — und nicht, in welcher
    Reihenfolge die Zimmer angebaut wurden. Das Nacheinander steht weiterhin in
    den Wanderungen; es ist die Geschichte, nicht der Zustand.

    -------------------------------------------------------------------------
    WARUM AM ENDE `schema_version` GEFUELLT WIRD
    -------------------------------------------------------------------------

    Der Wanderungslauf prueft Pruefsummen. Stuenden die neunzehn Zeilen nicht
    da, liefe er 0001 bis 0019 ueber ein Schema, das schon alles hat — das
    meiste ginge als „schon vorhanden" durch, aber 0012 legt
    `ck_slug_reachable` ungeschuetzt an und faellt hin.

    Die Pruefsummen sind ABGESCHRIEBEN, nicht ausgerechnet: der Lauf
    normalisiert Zeilenenden, bevor er hasht, und eine selbst gerechnete Summe,
    die daran vorbeigeht, meldet spaeter eine Verfaelschung, die es nicht gibt.

    -------------------------------------------------------------------------
    WAS HIER NICHT STEHT
    -------------------------------------------------------------------------

    Die Aussaat aus 0010 und 0015 — `parish`, `start` und die Wurzel. Sie
    gelten als angewendet und laufen nicht noch einmal; das Register bleibt
    LEER. Das ist der Sinn der Uebung: Adressen und Codes entstehen neu.
*/

IF SCHEMA_ID('app') IS NULL EXEC('CREATE SCHEMA app');
GO

/* =========================================================================
   1. Identitaet und Schluessel
   ========================================================================= */

CREATE TABLE app.account
(
    id                uniqueidentifier NOT NULL,
    login_id          nvarchar(64)     NOT NULL,
    password_salt     varbinary(32)    NOT NULL,
    login_salt        varbinary(32)    NOT NULL,
    login_verifier    varbinary(64)    NOT NULL,
    master_key_sealed varbinary(max)   NOT NULL,
    created_at        datetimeoffset   NOT NULL,
    disabled_at       datetimeoffset   NULL,

    -- 0006: welche Rolle DIESES Konto ist.
    person_role_id    uniqueidentifier NULL,

    CONSTRAINT pk_account PRIMARY KEY (id)
);
GO

CREATE UNIQUE INDEX ux_account_login ON app.account (login_id);
GO

CREATE TABLE app.role
(
    id                  uniqueidentifier NOT NULL,
    kind                nvarchar(16)     NOT NULL,

    display_name_sealed varbinary(max)   NULL,

    -- Oeffentliche Haelften: damit kann man geben, ohne etwas zu haben.
    wrap_public_key     varbinary(max)   NOT NULL,
    sign_public_key     varbinary(max)   NOT NULL,

    -- 0006: die privaten Haelften, versiegelt unter dem Rollenschluessel.
    sign_private_sealed varbinary(max)   NULL,
    wrap_private_sealed varbinary(max)   NULL,

    created_at          datetimeoffset   NOT NULL,
    revoked_at          datetimeoffset   NULL,

    CONSTRAINT pk_role PRIMARY KEY (id),

    -- 0011: person, role, group — die Woerter, die im Haus benutzt werden.
    CONSTRAINT ck_role_kind CHECK (kind IN (N'person', N'role', N'group'))
);
GO

ALTER TABLE app.account ADD CONSTRAINT fk_account_person_role
    FOREIGN KEY (person_role_id) REFERENCES app.role (id);
GO

CREATE UNIQUE INDEX ux_account_person_role ON app.account (person_role_id)
    WHERE person_role_id IS NOT NULL;
GO

CREATE TABLE app.session
(
    id           uniqueidentifier NOT NULL,
    account_id   uniqueidentifier NOT NULL,
    token_sha256 varbinary(32)    NOT NULL,

    created_at   datetimeoffset   NOT NULL,
    expires_at   datetimeoffset   NOT NULL,
    revoked_at   datetimeoffset   NULL,

    CONSTRAINT pk_session PRIMARY KEY (id),
    CONSTRAINT fk_session_account FOREIGN KEY (account_id) REFERENCES app.account (id)
);
GO

CREATE UNIQUE INDEX ux_session_token ON app.session (token_sha256);
GO

CREATE TABLE app.role_edge
(
    id             uniqueidentifier NOT NULL,
    from_role_id   uniqueidentifier NOT NULL,
    to_role_id     uniqueidentifier NOT NULL,
    signer_role_id uniqueidentifier NOT NULL,
    signature      varbinary(max)   NOT NULL,

    created_at     datetimeoffset   NOT NULL,
    revoked_at     datetimeoffset   NULL,

    -- 0008: was unterschrieben wird, muss auch in der Zeile stehen.
    edge_kind      nvarchar(16)     NOT NULL CONSTRAINT df_role_edge_kind DEFAULT (N'holds'),
    expires_at     datetimeoffset   NULL,

    CONSTRAINT pk_role_edge PRIMARY KEY (id),
    CONSTRAINT fk_role_edge_from FOREIGN KEY (from_role_id) REFERENCES app.role (id),
    CONSTRAINT fk_role_edge_to   FOREIGN KEY (to_role_id)   REFERENCES app.role (id),
    CONSTRAINT ck_role_edge_loop CHECK (from_role_id <> to_role_id),
    CONSTRAINT ck_role_edge_kind CHECK (edge_kind IN (N'holds', N'inherits', N'supervises'))
);
GO

CREATE UNIQUE INDEX ux_role_edge_pair ON app.role_edge (from_role_id, to_role_id)
    WHERE revoked_at IS NULL;
GO

/*
    Der Bereich — die Einheit der Vertraulichkeit.

    0019 gab ihm einen Namen: er steht fuer sich und sagt selbst, was er ist.
*/
CREATE TABLE app.area
(
    id            uniqueidentifier NOT NULL,
    current_epoch int              NOT NULL,
    created_at    datetimeoffset   NOT NULL,

    name          nvarchar(200)    NOT NULL CONSTRAINT df_area_name DEFAULT (N''),

    CONSTRAINT pk_area PRIMARY KEY (id),
    CONSTRAINT ck_area_epoch CHECK (current_epoch >= 1),
    CONSTRAINT ck_area_name CHECK (LEN(LTRIM(RTRIM(name))) > 0)
);
GO

CREATE TABLE app.area_epoch
(
    area_id        uniqueidentifier NOT NULL,
    epoch          int              NOT NULL,
    reason         nvarchar(24)     NOT NULL,
    cut_by_role_id uniqueidentifier NULL,
    created_at     datetimeoffset   NOT NULL,

    -- 0019: NULL heisst nicht veroeffentlicht. Steht hier etwas, ist es der
    -- Epochenschluessel selbst, roh und offen.
    key_public     varbinary(64)    NULL,

    CONSTRAINT pk_area_epoch PRIMARY KEY (area_id, epoch),
    CONSTRAINT fk_area_epoch_area FOREIGN KEY (area_id) REFERENCES app.area (id),
    CONSTRAINT ck_area_epoch_reason
        CHECK (reason IN (N'initial', N'member_added', N'member_left', N'rotation')),
    CONSTRAINT ck_area_epoch_key_public
        CHECK (key_public IS NULL OR DATALENGTH(key_public) = 32)
);
GO

CREATE INDEX ix_area_epoch_public ON app.area_epoch (area_id, epoch)
    WHERE key_public IS NOT NULL;
GO

CREATE TABLE app.key_grant
(
    id                 uniqueidentifier NOT NULL,
    role_id            uniqueidentifier NOT NULL,

    key_kind           nvarchar(16)     NOT NULL,
    key_ref            uniqueidentifier NOT NULL,
    key_epoch          int              NULL,

    sealed_blob        varbinary(max)   NOT NULL,

    granted_by_role_id uniqueidentifier NOT NULL,
    created_at         datetimeoffset   NOT NULL,
    destroyed_at       datetimeoffset   NULL,

    CONSTRAINT pk_key_grant PRIMARY KEY (id),
    CONSTRAINT fk_key_grant_role FOREIGN KEY (role_id) REFERENCES app.role (id),

    CONSTRAINT ck_key_grant_kind
        CHECK (key_kind IN (N'role', N'epoch', N'shared_view', N'data')),

    CONSTRAINT ck_key_grant_epoch
        CHECK ((key_kind = N'epoch' AND key_epoch IS NOT NULL)
            OR (key_kind <> N'epoch' AND key_epoch IS NULL))
);
GO

CREATE UNIQUE INDEX ux_key_grant_one
    ON app.key_grant (role_id, key_kind, key_ref, key_epoch)
    WHERE destroyed_at IS NULL;
GO

CREATE INDEX ix_key_grant_role ON app.key_grant (role_id) WHERE destroyed_at IS NULL;
GO

CREATE TABLE app.certificate
(
    id                uniqueidentifier NOT NULL,
    subject_role_id   uniqueidentifier NOT NULL,

    scope_kind        nvarchar(16)     NOT NULL,
    scope_id          uniqueidentifier NOT NULL,
    capability        nvarchar(16)     NOT NULL,

    issued_by_role_id uniqueidentifier NOT NULL,
    signature         varbinary(max)   NOT NULL,

    issued_at         datetimeoffset   NOT NULL,
    expires_at        datetimeoffset   NOT NULL,
    revoked_at        datetimeoffset   NULL,

    CONSTRAINT pk_certificate PRIMARY KEY (id),
    CONSTRAINT fk_certificate_subject FOREIGN KEY (subject_role_id) REFERENCES app.role (id),

    -- 0012: die Adresse kam dazu.
    CONSTRAINT ck_certificate_scope CHECK (scope_kind IN (N'area', N'body', N'slug')),
    CONSTRAINT ck_certificate_capability
        CHECK (capability IN (N'read', N'write', N'admin', N'certify'))
);
GO

CREATE INDEX ix_certificate_scope
    ON app.certificate (scope_kind, scope_id, subject_role_id)
    WHERE revoked_at IS NULL;
GO

/* =========================================================================
   2. Der Koerper — Organisation, Gruppe, Ereignis
   ========================================================================= */

CREATE TABLE app.body
(
    id             uniqueidentifier NOT NULL,
    kind           nvarchar(16)     NOT NULL,

    area_id        uniqueidentifier NOT NULL,
    office_role_id uniqueidentifier NOT NULL,
    member_role_id uniqueidentifier NOT NULL,

    parent_body_id uniqueidentifier NULL,

    slug           nvarchar(80)  NOT NULL,
    name           nvarchar(200) NOT NULL,
    summary        nvarchar(400) NULL,
    meets          nvarchar(200) NULL,

    is_public      bit NOT NULL CONSTRAINT df_body_public DEFAULT (1),

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

    CONSTRAINT ck_body_note
        CHECK ((note_sealed IS NULL AND note_epoch IS NULL)
            OR (note_sealed IS NOT NULL AND note_epoch IS NOT NULL)),

    CONSTRAINT ck_body_parent CHECK (parent_body_id IS NULL OR parent_body_id <> id)
);
GO

CREATE UNIQUE INDEX ux_body_area ON app.body (area_id);
GO

CREATE UNIQUE INDEX ux_body_slug ON app.body (parent_body_id, slug);
GO

CREATE INDEX ix_body_parent ON app.body (parent_body_id) WHERE parent_body_id IS NOT NULL;
GO

CREATE TABLE app.organisation
(
    body_id            uniqueidentifier NOT NULL,

    controller_name    nvarchar(200) NOT NULL,
    controller_address nvarchar(400) NULL,
    controller_email   nvarchar(200) NULL,

    theme              nvarchar(max) NULL,

    CONSTRAINT pk_organisation PRIMARY KEY (body_id),
    CONSTRAINT fk_organisation_body FOREIGN KEY (body_id) REFERENCES app.body (id)
);
GO

CREATE TABLE app.event
(
    body_id    uniqueidentifier NOT NULL,

    starts_at  datetimeoffset NULL,
    ends_at    datetimeoffset NULL,
    date_label nvarchar(120) NULL,
    place      nvarchar(200) NULL,
    category   nvarchar(120) NULL,

    CONSTRAINT pk_event PRIMARY KEY (body_id),
    CONSTRAINT fk_event_body FOREIGN KEY (body_id) REFERENCES app.body (id),
    CONSTRAINT ck_event_span
        CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at >= starts_at)
);
GO

CREATE INDEX ix_event_when ON app.event (starts_at) WHERE starts_at IS NOT NULL;
GO

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
GO

CREATE UNIQUE INDEX ux_body_listing_pair ON app.body_listing (organisation_id, body_id);
GO

/* =========================================================================
   3. Die Seitenmaschine am Koerper
   ========================================================================= */

CREATE TABLE app.page
(
    id         uniqueidentifier NOT NULL,
    body_id    uniqueidentifier NOT NULL,

    slug       nvarchar(80)  NOT NULL,
    title      nvarchar(200) NOT NULL,
    menu_label nvarchar(120) NULL,

    kind       nvarchar(16) NOT NULL CONSTRAINT df_page_kind DEFAULT (N'public'),

    position   int NOT NULL,
    created_at datetimeoffset NOT NULL,

    CONSTRAINT pk_page PRIMARY KEY (id),
    CONSTRAINT fk_page_body FOREIGN KEY (body_id) REFERENCES app.body (id),
    CONSTRAINT ck_page_kind CHECK (kind IN (N'public', N'internal'))
);
GO

CREATE UNIQUE INDEX ux_page_slug ON app.page (body_id, slug);
GO

CREATE TABLE app.page_part
(
    id           uniqueidentifier NOT NULL,
    page_id      uniqueidentifier NOT NULL,

    kind         nvarchar(40) NOT NULL,
    position     int NOT NULL,

    title_public nvarchar(200)  NULL,
    title_sealed varbinary(max) NULL,
    intro_sealed varbinary(max) NULL,

    config       nvarchar(max) NULL,

    is_public    bit NOT NULL CONSTRAINT df_page_part_public DEFAULT (1),
    epoch        int NULL,

    created_at   datetimeoffset NOT NULL,

    CONSTRAINT pk_page_part PRIMARY KEY (id),
    CONSTRAINT fk_page_part_page FOREIGN KEY (page_id) REFERENCES app.page (id),

    CONSTRAINT ck_page_part_epoch
        CHECK ((title_sealed IS NULL AND intro_sealed IS NULL) OR epoch IS NOT NULL)
);
GO

CREATE INDEX ix_page_part_page ON app.page_part (page_id, position);
GO

CREATE TABLE app.page_field
(
    id             uniqueidentifier NOT NULL,
    part_id        uniqueidentifier NOT NULL,

    kind           nvarchar(24)  NOT NULL,
    position       int           NOT NULL,

    label_sealed   varbinary(max) NOT NULL,
    help_sealed    varbinary(max) NULL,
    options_sealed varbinary(max) NULL,
    epoch          int NOT NULL,

    is_required    bit NOT NULL CONSTRAINT df_page_field_required DEFAULT (0),
    is_half_width  bit NOT NULL CONSTRAINT df_page_field_half     DEFAULT (0),

    identity_role  nvarchar(16) NOT NULL CONSTRAINT df_page_field_identity DEFAULT (N'none'),

    CONSTRAINT pk_page_field PRIMARY KEY (id),
    CONSTRAINT fk_page_field_part FOREIGN KEY (part_id) REFERENCES app.page_part (id),
    CONSTRAINT ck_page_field_identity
        CHECK (identity_role IN (N'none', N'name', N'contact'))
);
GO

CREATE INDEX ix_page_field_part ON app.page_field (part_id, position);
GO

/* =========================================================================
   4. Der Arbeitsplatz am BEREICH — Kalender, Gespraech, Anhang
   ========================================================================= */

CREATE TABLE app.calendar
(
    id         uniqueidentifier NOT NULL,
    area_id    uniqueidentifier NOT NULL,

    title      nvarchar(200) NOT NULL,
    time_zone  nvarchar(64) NOT NULL CONSTRAINT df_calendar_zone DEFAULT (N'Europe/Warsaw'),

    created_at datetimeoffset NOT NULL,

    CONSTRAINT pk_calendar PRIMARY KEY (id),
    CONSTRAINT fk_calendar_area FOREIGN KEY (area_id) REFERENCES app.area (id)
);
GO

CREATE INDEX ix_calendar_area ON app.calendar (area_id);
GO

CREATE TABLE app.calendar_item
(
    id              uniqueidentifier NOT NULL,
    calendar_id     uniqueidentifier NOT NULL,
    owner_role_id   uniqueidentifier NOT NULL,

    kind            nvarchar(24) NOT NULL CONSTRAINT df_item_kind DEFAULT (N'appointment'),

    starts_at       datetimeoffset NOT NULL,
    ends_at         datetimeoffset NOT NULL,
    all_day         bit NOT NULL CONSTRAINT df_item_allday DEFAULT (0),

    title_public    nvarchar(200)  NULL,
    title_sealed    varbinary(max) NULL,
    location_sealed varbinary(max) NULL,
    notes_sealed    varbinary(max) NULL,
    epoch           int NULL,

    visibility      nvarchar(16) NOT NULL CONSTRAINT df_item_visibility DEFAULT (N'area'),
    status          nvarchar(16) NOT NULL CONSTRAINT df_item_status DEFAULT (N'planned'),

    task_state      nvarchar(16) NULL,
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

    CONSTRAINT ck_item_repeat_end
        CHECK (repeat_kind = N'none' OR repeat_until IS NOT NULL OR repeat_count IS NOT NULL),

    CONSTRAINT ck_item_epoch
        CHECK ((title_sealed IS NULL AND location_sealed IS NULL AND notes_sealed IS NULL)
            OR epoch IS NOT NULL)
);
GO

CREATE INDEX ix_item_window ON app.calendar_item (calendar_id, starts_at) INCLUDE (ends_at);
GO

CREATE INDEX ix_item_topic ON app.calendar_item (topic_id) WHERE topic_id IS NOT NULL;
GO

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
GO

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
GO

CREATE INDEX ix_message_area ON app.message (area_id, created_at DESC);
GO

CREATE TABLE app.topic
(
    id              uniqueidentifier NOT NULL,
    area_id         uniqueidentifier NOT NULL,

    title_sealed    varbinary(max) NOT NULL,
    epoch           int            NOT NULL,

    parent_topic_id uniqueidentifier NULL,

    closed_at       datetimeoffset NULL,
    created_at      datetimeoffset NOT NULL,

    CONSTRAINT pk_topic PRIMARY KEY (id),
    CONSTRAINT fk_topic_area   FOREIGN KEY (area_id) REFERENCES app.area (id),
    CONSTRAINT fk_topic_parent FOREIGN KEY (parent_topic_id) REFERENCES app.topic (id)
);
GO

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
GO

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
GO

CREATE INDEX ix_attachment_owner ON app.attachment (owner_kind, owner_id);
GO

/* =========================================================================
   5. Der Uebergang — Annahme, Einladung, Zugang, Anmeldung
   ========================================================================= */

CREATE TABLE app.intake
(
    body_id            uniqueidentifier NOT NULL,

    public_key         varbinary(max) NOT NULL,
    private_key_sealed varbinary(max) NOT NULL,
    sealed_for_role_id uniqueidentifier NOT NULL,

    created_at         datetimeoffset NOT NULL,

    CONSTRAINT pk_intake PRIMARY KEY (body_id),
    CONSTRAINT fk_intake_body FOREIGN KEY (body_id) REFERENCES app.body (id),
    CONSTRAINT fk_intake_role FOREIGN KEY (sealed_for_role_id) REFERENCES app.role (id)
);
GO

CREATE TABLE app.invitation
(
    id                 uniqueidentifier NOT NULL,
    role_id            uniqueidentifier NOT NULL,

    token_sha256       varbinary(32)  NOT NULL,
    sealed_role_key    varbinary(max) NOT NULL,

    label              nvarchar(200) NULL,
    max_uses           int NOT NULL CONSTRAINT df_invitation_uses DEFAULT (1),
    used_count         int NOT NULL CONSTRAINT df_invitation_used DEFAULT (0),

    created_by_role_id uniqueidentifier NOT NULL,
    created_at         datetimeoffset NOT NULL,
    expires_at         datetimeoffset NOT NULL,
    revoked_at         datetimeoffset NULL,

    CONSTRAINT pk_invitation PRIMARY KEY (id),
    CONSTRAINT fk_invitation_role FOREIGN KEY (role_id) REFERENCES app.role (id),
    CONSTRAINT ck_invitation_uses CHECK (max_uses >= 1 AND used_count >= 0)
);
GO

CREATE UNIQUE INDEX ux_invitation_token ON app.invitation (token_sha256);
GO

CREATE TABLE app.invitation_redemption
(
    invitation_id uniqueidentifier NOT NULL,
    role_id       uniqueidentifier NOT NULL,
    redeemed_at   datetimeoffset   NOT NULL,

    CONSTRAINT pk_invitation_redemption PRIMARY KEY (invitation_id, role_id),
    CONSTRAINT fk_redemption_invitation FOREIGN KEY (invitation_id) REFERENCES app.invitation (id),
    CONSTRAINT fk_redemption_role       FOREIGN KEY (role_id)       REFERENCES app.role (id)
);
GO

CREATE TABLE app.access
(
    id                   uniqueidentifier NOT NULL,
    body_id              uniqueidentifier NOT NULL,

    token_sha256         varbinary(32)  NOT NULL,
    epoch_key_sealed     varbinary(max) NOT NULL,
    epoch                int NOT NULL,

    recipient_name       nvarchar(200) NULL,

    personal_note_sealed varbinary(max) NULL,
    internal_note_sealed varbinary(max) NULL,

    status               nvarchar(16) NOT NULL CONSTRAINT df_access_status DEFAULT (N'active'),
    view_count           int NOT NULL CONSTRAINT df_access_views DEFAULT (0),

    created_at           datetimeoffset NOT NULL,
    expires_at           datetimeoffset NULL,
    revoked_at           datetimeoffset NULL,

    CONSTRAINT pk_access PRIMARY KEY (id),
    CONSTRAINT fk_access_body FOREIGN KEY (body_id) REFERENCES app.body (id),
    CONSTRAINT ck_access_status CHECK (status IN (N'active', N'revoked', N'spent'))
);
GO

CREATE UNIQUE INDEX ux_access_token ON app.access (token_sha256);
GO

CREATE TABLE app.access_page
(
    access_id uniqueidentifier NOT NULL,
    page_id   uniqueidentifier NOT NULL,

    CONSTRAINT pk_access_page PRIMARY KEY (access_id, page_id),
    CONSTRAINT fk_access_page_access FOREIGN KEY (access_id) REFERENCES app.access (id),
    CONSTRAINT fk_access_page_page   FOREIGN KEY (page_id)   REFERENCES app.page (id)
);
GO

CREATE TABLE app.registration
(
    id           uniqueidentifier NOT NULL,
    part_id      uniqueidentifier NOT NULL,

    access_id    uniqueidentifier NULL,
    role_id      uniqueidentifier NULL,
    claim_sha256 varbinary(32)    NULL,

    submitted_at datetimeoffset NOT NULL,
    withdrawn_at datetimeoffset NULL,
    is_hidden    bit NOT NULL CONSTRAINT df_registration_hidden DEFAULT (0),

    CONSTRAINT pk_registration PRIMARY KEY (id),
    CONSTRAINT fk_registration_part   FOREIGN KEY (part_id)   REFERENCES app.page_part (id),
    CONSTRAINT fk_registration_access FOREIGN KEY (access_id) REFERENCES app.access (id),

    CONSTRAINT ck_registration_who
        CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR claim_sha256 IS NOT NULL)
);
GO

CREATE INDEX ix_registration_part ON app.registration (part_id, submitted_at);
GO

CREATE TABLE app.registration_value
(
    registration_id uniqueidentifier NOT NULL,
    field_id        uniqueidentifier NOT NULL,

    value_sealed    varbinary(max) NOT NULL,
    wrapped_key     varbinary(max) NOT NULL,

    CONSTRAINT pk_registration_value PRIMARY KEY (registration_id, field_id),
    CONSTRAINT fk_registration_value_reg   FOREIGN KEY (registration_id) REFERENCES app.registration (id),
    CONSTRAINT fk_registration_value_field FOREIGN KEY (field_id)        REFERENCES app.page_field (id)
);
GO

CREATE TABLE app.person_value
(
    role_id      uniqueidentifier NOT NULL,
    field        nvarchar(32)     NOT NULL,

    value_sealed varbinary(max) NOT NULL,
    updated_at   datetimeoffset NOT NULL,

    CONSTRAINT pk_person_value PRIMARY KEY (role_id, field),
    CONSTRAINT fk_person_value_role FOREIGN KEY (role_id) REFERENCES app.role (id),
    CONSTRAINT ck_person_value_field
        CHECK (field IN (N'given_name', N'surname', N'phone', N'born', N'address', N'email'))
);
GO

/* =========================================================================
   6. Das Adressregister — die dritte Ordnung, neben Schluesseln und Rollen
   ========================================================================= */

CREATE TABLE app.slug
(
    id                    uniqueidentifier NOT NULL,

    path                  nvarchar(200)    NOT NULL,

    -- 0012: NULL heisst „nicht durch Eintippen zu haben" — von oben geoeffnet.
    claim_code_sha256     varbinary(32)    NULL,

    note                  nvarchar(200)    NULL,

    claimed_by_role_id    uniqueidentifier NULL,
    claimed_by_account_id uniqueidentifier NULL,
    claimed_at            datetimeoffset   NULL,

    created_at            datetimeoffset   NOT NULL,

    -- 0014: ein zweiter Weg zu derselben Seite.
    alias_of              nvarchar(200)    NULL,

    -- 0016: eine eigene Domain neben dem Pfad.
    host                  nvarchar(200)    NULL,

    CONSTRAINT pk_slug PRIMARY KEY (id),

    CONSTRAINT fk_slug_role    FOREIGN KEY (claimed_by_role_id)    REFERENCES app.role (id),
    CONSTRAINT fk_slug_account FOREIGN KEY (claimed_by_account_id) REFERENCES app.account (id),

    CONSTRAINT ck_slug_claim
        CHECK ((claimed_by_role_id IS NULL     AND claimed_at IS NULL AND claimed_by_account_id IS NULL)
            OR (claimed_by_role_id IS NOT NULL AND claimed_at IS NOT NULL)),

    -- 0014: die leere Zeichenkette ist die Wurzel (recreatio.pl selbst).
    CONSTRAINT ck_slug_path
        CHECK (path = N''
            OR (path = LOWER(path)
                AND LEN(path) > 0
                AND path NOT LIKE N'%[^a-z0-9/-]%'
                AND path NOT LIKE N'/%'
                AND path NOT LIKE N'%/'
                AND path NOT LIKE N'%//%')),

    CONSTRAINT ck_slug_reserved
        CHECK (path <> N'workspace' AND path NOT LIKE N'workspace/%'),

    -- 0012: ohne Code UND ohne Halter waere die Zeile unerreichbar.
    CONSTRAINT ck_slug_reachable
        CHECK (claim_code_sha256 IS NOT NULL OR claimed_by_role_id IS NOT NULL),

    CONSTRAINT ck_slug_alias_self CHECK (alias_of IS NULL OR alias_of <> path),

    CONSTRAINT ck_slug_host
        CHECK (host IS NULL
            OR (host = LOWER(host)
                AND LEN(host) > 3
                AND host LIKE N'%.%'
                AND host NOT LIKE N'%[^a-z0-9.-]%'
                AND host NOT LIKE N'.%'
                AND host NOT LIKE N'%.'
                AND host NOT LIKE N'%..%')),

    -- 0017: ein Code gehoert einer Wurzel, nie einer Unteradresse.
    CONSTRAINT ck_slug_root_code
        CHECK (claim_code_sha256 IS NULL OR CHARINDEX(N'/', path) = 0)
);
GO

CREATE UNIQUE INDEX ux_slug_path ON app.slug (path);
GO

CREATE INDEX ix_slug_role ON app.slug (claimed_by_role_id)
    WHERE claimed_by_role_id IS NOT NULL;
GO

CREATE INDEX ix_slug_alias ON app.slug (alias_of) WHERE alias_of IS NOT NULL;
GO

CREATE UNIQUE INDEX ux_slug_host ON app.slug (host) WHERE host IS NOT NULL;
GO

CREATE TABLE app.slug_page
(
    slug_id            uniqueidentifier NOT NULL,

    title              nvarchar(200)    NOT NULL,
    lead               nvarchar(4000)   NULL,

    updated_at         datetimeoffset   NOT NULL,
    updated_by_role_id uniqueidentifier NULL,

    CONSTRAINT pk_slug_page PRIMARY KEY (slug_id),
    CONSTRAINT fk_slug_page_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
    CONSTRAINT fk_slug_page_role FOREIGN KEY (updated_by_role_id) REFERENCES app.role (id),

    CONSTRAINT ck_slug_page_title CHECK (LEN(title) > 0)
);
GO

CREATE TABLE app.slug_part
(
    id         uniqueidentifier NOT NULL,
    slug_id    uniqueidentifier NOT NULL,

    kind       nvarchar(40)     NOT NULL,
    position   int              NOT NULL,

    layout     nvarchar(max)    NOT NULL,
    config     nvarchar(max)    NULL,

    created_at datetimeoffset   NOT NULL,

    CONSTRAINT pk_slug_part PRIMARY KEY (id),
    CONSTRAINT fk_slug_part_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
    CONSTRAINT ck_slug_part_kind CHECK (LEN(kind) > 0)
);
GO

CREATE INDEX ix_slug_part_slug ON app.slug_part (slug_id, position);
GO

/* =========================================================================
   7. Messen und Intentionen
   ========================================================================= */

CREATE TABLE app.mass_item
(
    id            uniqueidentifier NOT NULL,
    slug_id       uniqueidentifier NOT NULL,

    item_type     nvarchar(20) NOT NULL CONSTRAINT df_mass_item_type DEFAULT (N'mass'),
    title_public  nvarchar(200) NULL,

    starts_at     datetimeoffset(7) NOT NULL,
    time_zone     nvarchar(60) NOT NULL CONSTRAINT df_mass_item_tz DEFAULT (N'Europe/Warsaw'),
    minutes       int NOT NULL CONSTRAINT df_mass_item_minutes DEFAULT (45),

    repeat_kind   nvarchar(20) NOT NULL CONSTRAINT df_mass_item_repeat DEFAULT (N'none'),
    repeat_weekdays int NULL,
    repeat_until  datetimeoffset(7) NULL,

    created_by_role_id uniqueidentifier NULL,
    created_at    datetimeoffset(7) NOT NULL,
    updated_at    datetimeoffset(7) NOT NULL,

    CONSTRAINT pk_mass_item PRIMARY KEY (id),
    CONSTRAINT fk_mass_item_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),

    CONSTRAINT ck_mass_item_type CHECK (item_type IN (N'mass', N'confession')),
    CONSTRAINT ck_mass_item_repeat CHECK (repeat_kind IN (N'none', N'weekly', N'daily')),
    CONSTRAINT ck_mass_item_minutes CHECK (minutes BETWEEN 5 AND 480),

    CONSTRAINT ck_mass_item_until
        CHECK ((repeat_kind = N'none' AND repeat_until IS NULL)
            OR (repeat_kind <> N'none' AND repeat_until IS NOT NULL)),

    CONSTRAINT ck_mass_item_weekdays
        CHECK ((repeat_kind <> N'weekly' AND repeat_weekdays IS NULL)
            OR (repeat_kind = N'weekly' AND repeat_weekdays BETWEEN 1 AND 127))
);
GO

CREATE INDEX ix_mass_item_slug ON app.mass_item (slug_id, starts_at);
GO

CREATE TABLE app.mass_intention
(
    id            uniqueidentifier NOT NULL,

    item_id       uniqueidentifier NOT NULL,
    occurrence_at datetimeoffset(7) NOT NULL,

    ordinal       int NOT NULL CONSTRAINT df_mass_intention_ord DEFAULT (0),
    text_public   nvarchar(400) NOT NULL,

    kind          nvarchar(20) NOT NULL CONSTRAINT df_mass_intention_kind DEFAULT (N'single'),
    celebrant_role_id uniqueidentifier NULL,

    status        nvarchar(20) NOT NULL CONSTRAINT df_mass_intention_status DEFAULT (N'accepted'),

    created_by_role_id uniqueidentifier NULL,
    created_at    datetimeoffset(7) NOT NULL,
    updated_at    datetimeoffset(7) NOT NULL,

    CONSTRAINT pk_mass_intention PRIMARY KEY (id),
    CONSTRAINT fk_mass_intention_item FOREIGN KEY (item_id) REFERENCES app.mass_item (id),
    CONSTRAINT fk_mass_intention_celebrant FOREIGN KEY (celebrant_role_id) REFERENCES app.role (id),

    CONSTRAINT ck_mass_intention_kind CHECK (kind IN (N'single', N'collective')),
    CONSTRAINT ck_mass_intention_status
        CHECK (status IN (N'accepted', N'cancelled', N'celebrated')),
    CONSTRAINT ck_mass_intention_text CHECK (LEN(LTRIM(RTRIM(text_public))) > 0)
);
GO

CREATE UNIQUE INDEX uq_mass_intention_celebrant
    ON app.mass_intention (item_id, occurrence_at, celebrant_role_id)
    WHERE kind = N'single'
      AND celebrant_role_id IS NOT NULL
      AND status <> N'cancelled';
GO

CREATE INDEX ix_mass_intention_at
    ON app.mass_intention (item_id, occurrence_at, ordinal);
GO

/* =========================================================================
   8. Das Gedaechtnis des Wanderungslaufs
   ========================================================================= */

CREATE TABLE app.schema_version
(
    name       nvarchar(200)  NOT NULL,
    checksum   char(64)       NOT NULL,
    applied_at datetimeoffset NOT NULL,
    CONSTRAINT pk_schema_version PRIMARY KEY (name)
);
GO

/*
    Die neunzehn als angewendet eintragen.

    Die Pruefsummen sind aus der Datenbank abgeschrieben, die dieses Schema
    hervorgebracht hat. Selbst gerechnete gingen an der Normalisierung der
    Zeilenenden vorbei, und der naechste Lauf meldete eine Verfaelschung, die
    es nicht gibt.

    0010 und 0015 stehen mit darin, und das ist die Absicht: ihre Aussaat
    (`parish`, `start`, die Wurzel) laeuft NICHT noch einmal. Das Register
    bleibt leer.
*/
INSERT INTO app.schema_version (name, checksum, applied_at)
VALUES
    (N'0001_identity.sql',         'aa2167c6a8a3c1edfc8d322645dafa47790669dc44fded5ca6bcac8282930cc5', SYSDATETIMEOFFSET()),
    (N'0002_body.sql',             '2803d5f3a141111a15bcee8b9e976d5fbe4f7dd5cc4db7b0cb15262127278862', SYSDATETIMEOFFSET()),
    (N'0003_page.sql',             'c4daa69a25aee5180cd31a5bbe2c8113702b1054529c24dc2454f5e345dc635b', SYSDATETIMEOFFSET()),
    (N'0004_workspace.sql',        '5a0382ec4bbb18c7fc3e3fcb645aa17e26f3df56fd46cb8e65b8ca2fa0c163e2', SYSDATETIMEOFFSET()),
    (N'0005_intake.sql',           'ec5574ec8bfec7d019edb08cc1b92cd2a4da5fec758172558ef17e5bc858a542', SYSDATETIMEOFFSET()),
    (N'0006_person_role.sql',      '0b5afa8d081089f9c3a13481fc546859ec929da9daa850c6a8c89b7a2c4ff869', SYSDATETIMEOFFSET()),
    (N'0007_slug.sql',             'd6ce67b4acd6ae301678c763aa298e77720f537e65021f1afdeee15186c3e5db', SYSDATETIMEOFFSET()),
    (N'0008_role_edge_shape.sql',  '07d22060b1ef5d64ea48d70e0224e09677508ee584de77bc8132450a670a85f4', SYSDATETIMEOFFSET()),
    (N'0009_slug_page.sql',        'f096c941096ecf04d3d0aacf039d2306e8bd9ebcb229a48ef2033cceb4c23434', SYSDATETIMEOFFSET()),
    (N'0010_seed_parish.sql',      'dcbff832e250e9547308ca9f7f94954d2aa60f399e2478d72e786e9ef82b4342', SYSDATETIMEOFFSET()),
    (N'0011_role_kind.sql',        '8ccf9b60f660823145b85a11ef7803046150d97dd13c4ca38e63f82ed50935b5', SYSDATETIMEOFFSET()),
    (N'0012_page_access.sql',      'dd5a73d292a3b29584f7c2965540ecbfdf0cc9af2631407c6df6bf6310e687c2', SYSDATETIMEOFFSET()),
    (N'0013_slug_part.sql',        '6d1613089071e400acbb657bde0edb9d780b84a40734be54f8500d653d17dc2c', SYSDATETIMEOFFSET()),
    (N'0014_slug_alias.sql',       'e8e9adf7d0bd43c5ff9919c72c43700c802b1118a34b407c1c3bc870988fdf09', SYSDATETIMEOFFSET()),
    (N'0015_seed_start.sql',       'c30672851aa899c5ecee6c075a6e4f4ec4f008d3f6573a062c6cee652104416d', SYSDATETIMEOFFSET()),
    (N'0016_slug_host.sql',        'd4d3def7f11d23f03b71e441f5a99bee93caa39bf5fad5195d03afff420b8b42', SYSDATETIMEOFFSET()),
    (N'0017_root_code.sql',        '0946fdf562a5f99393600f9dac6a770aadbf76deaab2e7124e80671ea4fa4cab', SYSDATETIMEOFFSET()),
    (N'0018_mass.sql',             '0ce1c5f0060efe66c4c5e469199552ffeaa66637ad7a7645b85e4c0184b8ac69', SYSDATETIMEOFFSET()),
    (N'0019_area_named.sql',       'a6cd6f21c738d764d8c7e39b05b8e5d7e72d07879187579686a3d2f3d86eaf55', SYSDATETIMEOFFSET());
GO
