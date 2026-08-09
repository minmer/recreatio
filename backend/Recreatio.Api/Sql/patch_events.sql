-- Event2 module
-- Composable events: an organizer assembles pages from pre-prepared parts, then
-- hands out individual links that open specific internal pages.
--
-- Structure: Site → Pages (one 'public' + N 'internal') → Parts.
-- Access:    Event2AccessLinks × Event2AccessLinkPages (a grant per page).
--
-- Safe to run on an existing database; all statements are idempotent.
--
-- NOTE ON THE EARLIER DRAFT: a first version of this module used
-- Event2Blocks / Event2FormFields / Event2Submissions / Event2SubmissionValues /
-- Event2Invites / Event2InviteAssignments. Those tables are NOT touched here, so
-- running this patch destroys nothing. They are unused by the current code and
-- can be dropped once you are satisfied; see the commented block at the bottom.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'event2')
BEGIN
    EXEC('CREATE SCHEMA event2 AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'event2.Event2Sites', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2Sites
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2Sites PRIMARY KEY,
        Slug         NVARCHAR(80)     NOT NULL,
        Title        NVARCHAR(200)    NOT NULL,
        Subtitle     NVARCHAR(300)    NULL,
        -- Catalogue: what the events overview filters and sorts on.
        Summary      NVARCHAR(400)    NULL,
        Category     NVARCHAR(80)     NULL,   -- "Pielgrzymka rowerowa", "Warsztaty muzyczne"
        Audience     NVARCHAR(160)    NULL,   -- for whom
        PlacesJson   NVARCHAR(MAX)    NULL,   -- JSON array of the main places
        ThumbnailUrl NVARCHAR(600)    NULL,
        StartDate    DATE             NULL,
        EndDate      DATE             NULL,
        DateLabel    NVARCHAR(120)    NULL,   -- display override only
        ThemeJson    NVARCHAR(MAX)    NULL,
        IsPublished  BIT              NOT NULL,
        CreatedUtc   DATETIMEOFFSET   NOT NULL,
        UpdatedUtc   DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_Event2Sites_Slug UNIQUE (Slug)
    );
END
GO

-- Catalogue columns, added separately so a database created from an earlier
-- draft of this patch picks them up too.
IF OBJECT_ID(N'event2.Event2Sites', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('event2.Event2Sites', 'Summary') IS NULL
        ALTER TABLE event2.Event2Sites ADD Summary NVARCHAR(400) NULL;
    IF COL_LENGTH('event2.Event2Sites', 'Category') IS NULL
        ALTER TABLE event2.Event2Sites ADD Category NVARCHAR(80) NULL;
    IF COL_LENGTH('event2.Event2Sites', 'Audience') IS NULL
        ALTER TABLE event2.Event2Sites ADD Audience NVARCHAR(160) NULL;
    IF COL_LENGTH('event2.Event2Sites', 'PlacesJson') IS NULL
        ALTER TABLE event2.Event2Sites ADD PlacesJson NVARCHAR(MAX) NULL;
    IF COL_LENGTH('event2.Event2Sites', 'ThumbnailUrl') IS NULL
        ALTER TABLE event2.Event2Sites ADD ThumbnailUrl NVARCHAR(600) NULL;
    IF COL_LENGTH('event2.Event2Sites', 'StartDate') IS NULL
        ALTER TABLE event2.Event2Sites ADD StartDate DATE NULL;
    IF COL_LENGTH('event2.Event2Sites', 'EndDate') IS NULL
        ALTER TABLE event2.Event2Sites ADD EndDate DATE NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2Sites_Published_StartDate'
      AND object_id = OBJECT_ID('event2.Event2Sites')
)
BEGIN
    CREATE INDEX IX_Event2Sites_Published_StartDate ON event2.Event2Sites(IsPublished, StartDate);
END
GO

IF OBJECT_ID(N'event2.Event2Pages', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2Pages
    (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2Pages PRIMARY KEY,
        SiteId      UNIQUEIDENTIFIER NOT NULL,
        SortOrder   INT              NOT NULL,
        Kind        NVARCHAR(16)     NOT NULL,   -- public | internal
        Slug        NVARCHAR(80)     NOT NULL,
        Title       NVARCHAR(200)    NOT NULL,
        MenuLabel   NVARCHAR(60)     NOT NULL,
        Description NVARCHAR(600)    NULL,
        CreatedUtc  DATETIMEOFFSET   NOT NULL,
        UpdatedUtc  DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_Event2Pages_Site
            FOREIGN KEY (SiteId) REFERENCES event2.Event2Sites(Id),
        CONSTRAINT UX_Event2Pages_Site_Slug UNIQUE (SiteId, Slug)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2Pages_SiteId_SortOrder'
      AND object_id = OBJECT_ID('event2.Event2Pages')
)
BEGIN
    CREATE INDEX IX_Event2Pages_SiteId_SortOrder ON event2.Event2Pages(SiteId, SortOrder);
END
GO

IF OBJECT_ID(N'event2.Event2Parts', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2Parts
    (
        Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2Parts PRIMARY KEY,
        PageId     UNIQUEIDENTIFIER NOT NULL,
        SortOrder  INT              NOT NULL,
        Kind       NVARCHAR(20)     NOT NULL,
        MenuLabel  NVARCHAR(60)     NOT NULL,
        Title      NVARCHAR(200)    NULL,
        Intro      NVARCHAR(600)    NULL,
        ConfigJson NVARCHAR(MAX)    NULL,
        LayersJson NVARCHAR(MAX)    NULL,
        IsVisible  BIT              NOT NULL CONSTRAINT DF_Event2Parts_Visible DEFAULT(1),
        CreatedUtc DATETIMEOFFSET   NOT NULL,
        UpdatedUtc DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_Event2Parts_Page
            FOREIGN KEY (PageId) REFERENCES event2.Event2Pages(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2Parts_PageId_SortOrder'
      AND object_id = OBJECT_ID('event2.Event2Parts')
)
BEGIN
    CREATE INDEX IX_Event2Parts_PageId_SortOrder ON event2.Event2Parts(PageId, SortOrder);
END
GO

IF OBJECT_ID(N'event2.Event2PartFields', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2PartFields
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2PartFields PRIMARY KEY,
        PartId       UNIQUEIDENTIFIER NOT NULL,
        SortOrder    INT              NOT NULL,
        Kind         NVARCHAR(16)     NOT NULL,
        Label        NVARCHAR(300)    NOT NULL,
        HelpText     NVARCHAR(400)    NULL,
        OptionsJson  NVARCHAR(MAX)    NULL,
        IsRequired   BIT              NOT NULL,
        IsHalfWidth  BIT              NOT NULL CONSTRAINT DF_Event2PartFields_Half DEFAULT(0),
        IdentityRole NVARCHAR(12)     NOT NULL CONSTRAINT DF_Event2PartFields_Identity DEFAULT('none'),
        CONSTRAINT FK_Event2PartFields_Part
            FOREIGN KEY (PartId) REFERENCES event2.Event2Parts(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2PartFields_PartId_SortOrder'
      AND object_id = OBJECT_ID('event2.Event2PartFields')
)
BEGIN
    CREATE INDEX IX_Event2PartFields_PartId_SortOrder ON event2.Event2PartFields(PartId, SortOrder);
END
GO

IF OBJECT_ID(N'event2.Event2AccessLinks', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2AccessLinks
    (
        Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2AccessLinks PRIMARY KEY,
        SiteId             UNIQUEIDENTIFIER NOT NULL,
        Token              NVARCHAR(64)     NOT NULL,
        RecipientName      NVARCHAR(200)    NOT NULL,
        RecipientContact   NVARCHAR(200)    NULL,
        RegistrationId     UNIQUEIDENTIFIER NULL,
        Status             NVARCHAR(16)     NOT NULL,  -- active | revoked
        PersonalNote       NVARCHAR(1000)   NULL,
        InternalNote       NVARCHAR(1000)   NULL,
        ViewCount          INT              NOT NULL CONSTRAINT DF_Event2AccessLinks_Views DEFAULT(0),
        LastViewedUtc      DATETIMEOFFSET   NULL,
        CreatedUtc         DATETIMEOFFSET   NOT NULL,
        UpdatedUtc         DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_Event2AccessLinks_Token UNIQUE (Token),
        CONSTRAINT FK_Event2AccessLinks_Site
            FOREIGN KEY (SiteId) REFERENCES event2.Event2Sites(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2AccessLinks_SiteId_CreatedUtc'
      AND object_id = OBJECT_ID('event2.Event2AccessLinks')
)
BEGIN
    CREATE INDEX IX_Event2AccessLinks_SiteId_CreatedUtc
        ON event2.Event2AccessLinks(SiteId, CreatedUtc);
END
GO

IF OBJECT_ID(N'event2.Event2AccessLinkPages', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2AccessLinkPages
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2AccessLinkPages PRIMARY KEY,
        AccessLinkId UNIQUEIDENTIFIER NOT NULL,
        PageId       UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT FK_Event2AccessLinkPages_Link
            FOREIGN KEY (AccessLinkId) REFERENCES event2.Event2AccessLinks(Id),
        CONSTRAINT FK_Event2AccessLinkPages_Page
            FOREIGN KEY (PageId) REFERENCES event2.Event2Pages(Id),
        CONSTRAINT UX_Event2AccessLinkPages_Link_Page UNIQUE (AccessLinkId, PageId)
    );
END
GO

IF OBJECT_ID(N'event2.Event2AccessLinkAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2AccessLinkAssignments
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2AccessLinkAssignments PRIMARY KEY,
        AccessLinkId UNIQUEIDENTIFIER NOT NULL,
        SortOrder    INT              NOT NULL,
        Label        NVARCHAR(160)    NOT NULL,
        Value        NVARCHAR(600)    NOT NULL,
        CONSTRAINT FK_Event2AccessLinkAssignments_Link
            FOREIGN KEY (AccessLinkId) REFERENCES event2.Event2AccessLinks(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2AccessLinkAssignments_Link_SortOrder'
      AND object_id = OBJECT_ID('event2.Event2AccessLinkAssignments')
)
BEGIN
    CREATE INDEX IX_Event2AccessLinkAssignments_Link_SortOrder
        ON event2.Event2AccessLinkAssignments(AccessLinkId, SortOrder);
END
GO

IF OBJECT_ID(N'event2.Event2Registrations', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2Registrations
    (
        Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2Registrations PRIMARY KEY,
        SiteId             UNIQUEIDENTIFIER NOT NULL,
        PartId             UNIQUEIDENTIFIER NOT NULL,
        ParticipantName    NVARCHAR(200)    NULL,
        ParticipantContact NVARCHAR(200)    NULL,
        AccessLinkId       UNIQUEIDENTIFIER NULL,
        SubmittedUtc       DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_Event2Registrations_Site
            FOREIGN KEY (SiteId) REFERENCES event2.Event2Sites(Id),
        CONSTRAINT FK_Event2Registrations_Part
            FOREIGN KEY (PartId) REFERENCES event2.Event2Parts(Id),
        CONSTRAINT FK_Event2Registrations_Link
            FOREIGN KEY (AccessLinkId) REFERENCES event2.Event2AccessLinks(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2Registrations_SiteId_SubmittedUtc'
      AND object_id = OBJECT_ID('event2.Event2Registrations')
)
BEGIN
    CREATE INDEX IX_Event2Registrations_SiteId_SubmittedUtc
        ON event2.Event2Registrations(SiteId, SubmittedUtc);
END
GO

IF OBJECT_ID(N'event2.Event2RegistrationValues', N'U') IS NULL
BEGIN
    CREATE TABLE event2.Event2RegistrationValues
    (
        Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Event2RegistrationValues PRIMARY KEY,
        RegistrationId UNIQUEIDENTIFIER NOT NULL,
        FieldId        UNIQUEIDENTIFIER NOT NULL,
        FieldLabel     NVARCHAR(300)    NOT NULL,
        Value          NVARCHAR(4000)   NULL,
        CONSTRAINT FK_Event2RegistrationValues_Registration
            FOREIGN KEY (RegistrationId) REFERENCES event2.Event2Registrations(Id),
        CONSTRAINT FK_Event2RegistrationValues_Field
            FOREIGN KEY (FieldId) REFERENCES event2.Event2PartFields(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_Event2RegistrationValues_RegistrationId'
      AND object_id = OBJECT_ID('event2.Event2RegistrationValues')
)
BEGIN
    CREATE INDEX IX_Event2RegistrationValues_RegistrationId
        ON event2.Event2RegistrationValues(RegistrationId);
END
GO

-- ---------------------------------------------------------------------------
-- Optional cleanup of the superseded first-draft tables. Nothing in the running
-- code reads them. Review before executing; order matters because of the FKs.
--
-- DROP TABLE IF EXISTS event2.Event2SubmissionValues;
-- DROP TABLE IF EXISTS event2.Event2Submissions;
-- DROP TABLE IF EXISTS event2.Event2InviteAssignments;
-- DROP TABLE IF EXISTS event2.Event2Invites;
-- DROP TABLE IF EXISTS event2.Event2FormFields;
-- DROP TABLE IF EXISTS event2.Event2Blocks;
-- ---------------------------------------------------------------------------
