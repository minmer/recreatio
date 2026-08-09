-- Event module
-- Composable events: an organizer assembles pages from pre-prepared parts, then
-- hands out individual links that open specific internal pages.
--
-- Structure: Site → Pages (one 'public' + N 'internal') → Parts.
-- Access:    EventAccessLinks × EventAccessLinkPages (a grant per page).
--
-- Safe to run on an existing database; all statements are idempotent, and
-- nothing outside the [events] schema is touched.
--
-- If an earlier build of this module was ever applied it created its own
-- [event2] schema, which this patch leaves entirely alone. Nothing in the
-- running code reads it; see the commented cleanup at the bottom.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'events')
BEGIN
    EXEC('CREATE SCHEMA events AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'events.EventSites', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventSites
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventSites PRIMARY KEY,
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
        CONSTRAINT UX_EventSites_Slug UNIQUE (Slug)
    );
END
GO

-- Catalogue columns, added separately so a database created from an earlier
-- draft of this patch picks them up too.
IF OBJECT_ID(N'events.EventSites', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('events.EventSites', 'Summary') IS NULL
        ALTER TABLE events.EventSites ADD Summary NVARCHAR(400) NULL;
    IF COL_LENGTH('events.EventSites', 'Category') IS NULL
        ALTER TABLE events.EventSites ADD Category NVARCHAR(80) NULL;
    IF COL_LENGTH('events.EventSites', 'Audience') IS NULL
        ALTER TABLE events.EventSites ADD Audience NVARCHAR(160) NULL;
    IF COL_LENGTH('events.EventSites', 'PlacesJson') IS NULL
        ALTER TABLE events.EventSites ADD PlacesJson NVARCHAR(MAX) NULL;
    IF COL_LENGTH('events.EventSites', 'ThumbnailUrl') IS NULL
        ALTER TABLE events.EventSites ADD ThumbnailUrl NVARCHAR(600) NULL;
    IF COL_LENGTH('events.EventSites', 'StartDate') IS NULL
        ALTER TABLE events.EventSites ADD StartDate DATE NULL;
    IF COL_LENGTH('events.EventSites', 'EndDate') IS NULL
        ALTER TABLE events.EventSites ADD EndDate DATE NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventSites_Published_StartDate'
      AND object_id = OBJECT_ID('events.EventSites')
)
BEGIN
    CREATE INDEX IX_EventSites_Published_StartDate ON events.EventSites(IsPublished, StartDate);
END
GO

IF OBJECT_ID(N'events.EventPages', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventPages
    (
        Id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventPages PRIMARY KEY,
        SiteId      UNIQUEIDENTIFIER NOT NULL,
        SortOrder   INT              NOT NULL,
        Kind        NVARCHAR(16)     NOT NULL,   -- public | internal
        Slug        NVARCHAR(80)     NOT NULL,
        Title       NVARCHAR(200)    NOT NULL,
        MenuLabel   NVARCHAR(60)     NOT NULL,
        Description NVARCHAR(600)    NULL,
        CreatedUtc  DATETIMEOFFSET   NOT NULL,
        UpdatedUtc  DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_EventPages_Site
            FOREIGN KEY (SiteId) REFERENCES events.EventSites(Id),
        CONSTRAINT UX_EventPages_Site_Slug UNIQUE (SiteId, Slug)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventPages_SiteId_SortOrder'
      AND object_id = OBJECT_ID('events.EventPages')
)
BEGIN
    CREATE INDEX IX_EventPages_SiteId_SortOrder ON events.EventPages(SiteId, SortOrder);
END
GO

IF OBJECT_ID(N'events.EventParts', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventParts
    (
        Id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventParts PRIMARY KEY,
        PageId     UNIQUEIDENTIFIER NOT NULL,
        SortOrder  INT              NOT NULL,
        Kind       NVARCHAR(20)     NOT NULL,
        MenuLabel  NVARCHAR(60)     NOT NULL,
        Title      NVARCHAR(200)    NULL,
        Intro      NVARCHAR(600)    NULL,
        ConfigJson NVARCHAR(MAX)    NULL,
        LayersJson NVARCHAR(MAX)    NULL,
        IsVisible  BIT              NOT NULL CONSTRAINT DF_EventParts_Visible DEFAULT(1),
        CreatedUtc DATETIMEOFFSET   NOT NULL,
        UpdatedUtc DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_EventParts_Page
            FOREIGN KEY (PageId) REFERENCES events.EventPages(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventParts_PageId_SortOrder'
      AND object_id = OBJECT_ID('events.EventParts')
)
BEGIN
    CREATE INDEX IX_EventParts_PageId_SortOrder ON events.EventParts(PageId, SortOrder);
END
GO

IF OBJECT_ID(N'events.EventPartFields', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventPartFields
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventPartFields PRIMARY KEY,
        PartId       UNIQUEIDENTIFIER NOT NULL,
        SortOrder    INT              NOT NULL,
        Kind         NVARCHAR(16)     NOT NULL,
        Label        NVARCHAR(300)    NOT NULL,
        HelpText     NVARCHAR(400)    NULL,
        OptionsJson  NVARCHAR(MAX)    NULL,
        IsRequired   BIT              NOT NULL,
        IsHalfWidth  BIT              NOT NULL CONSTRAINT DF_EventPartFields_Half DEFAULT(0),
        IdentityRole NVARCHAR(12)     NOT NULL CONSTRAINT DF_EventPartFields_Identity DEFAULT('none'),
        CONSTRAINT FK_EventPartFields_Part
            FOREIGN KEY (PartId) REFERENCES events.EventParts(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventPartFields_PartId_SortOrder'
      AND object_id = OBJECT_ID('events.EventPartFields')
)
BEGIN
    CREATE INDEX IX_EventPartFields_PartId_SortOrder ON events.EventPartFields(PartId, SortOrder);
END
GO

IF OBJECT_ID(N'events.EventAccessLinks', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventAccessLinks
    (
        Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventAccessLinks PRIMARY KEY,
        SiteId             UNIQUEIDENTIFIER NOT NULL,
        Token              NVARCHAR(64)     NOT NULL,
        RecipientName      NVARCHAR(200)    NOT NULL,
        RecipientContact   NVARCHAR(200)    NULL,
        RegistrationId     UNIQUEIDENTIFIER NULL,
        Status             NVARCHAR(16)     NOT NULL,  -- active | revoked
        PersonalNote       NVARCHAR(1000)   NULL,
        InternalNote       NVARCHAR(1000)   NULL,
        ViewCount          INT              NOT NULL CONSTRAINT DF_EventAccessLinks_Views DEFAULT(0),
        LastViewedUtc      DATETIMEOFFSET   NULL,
        CreatedUtc         DATETIMEOFFSET   NOT NULL,
        UpdatedUtc         DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_EventAccessLinks_Token UNIQUE (Token),
        CONSTRAINT FK_EventAccessLinks_Site
            FOREIGN KEY (SiteId) REFERENCES events.EventSites(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventAccessLinks_SiteId_CreatedUtc'
      AND object_id = OBJECT_ID('events.EventAccessLinks')
)
BEGIN
    CREATE INDEX IX_EventAccessLinks_SiteId_CreatedUtc
        ON events.EventAccessLinks(SiteId, CreatedUtc);
END
GO

IF OBJECT_ID(N'events.EventAccessLinkPages', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventAccessLinkPages
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventAccessLinkPages PRIMARY KEY,
        AccessLinkId UNIQUEIDENTIFIER NOT NULL,
        PageId       UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT FK_EventAccessLinkPages_Link
            FOREIGN KEY (AccessLinkId) REFERENCES events.EventAccessLinks(Id),
        CONSTRAINT FK_EventAccessLinkPages_Page
            FOREIGN KEY (PageId) REFERENCES events.EventPages(Id),
        CONSTRAINT UX_EventAccessLinkPages_Link_Page UNIQUE (AccessLinkId, PageId)
    );
END
GO

IF OBJECT_ID(N'events.EventAccessLinkAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventAccessLinkAssignments
    (
        Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventAccessLinkAssignments PRIMARY KEY,
        AccessLinkId UNIQUEIDENTIFIER NOT NULL,
        SortOrder    INT              NOT NULL,
        Label        NVARCHAR(160)    NOT NULL,
        Value        NVARCHAR(600)    NOT NULL,
        CONSTRAINT FK_EventAccessLinkAssignments_Link
            FOREIGN KEY (AccessLinkId) REFERENCES events.EventAccessLinks(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventAccessLinkAssignments_Link_SortOrder'
      AND object_id = OBJECT_ID('events.EventAccessLinkAssignments')
)
BEGIN
    CREATE INDEX IX_EventAccessLinkAssignments_Link_SortOrder
        ON events.EventAccessLinkAssignments(AccessLinkId, SortOrder);
END
GO

IF OBJECT_ID(N'events.EventRegistrations', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventRegistrations
    (
        Id                 UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventRegistrations PRIMARY KEY,
        SiteId             UNIQUEIDENTIFIER NOT NULL,
        PartId             UNIQUEIDENTIFIER NOT NULL,
        ParticipantName    NVARCHAR(200)    NULL,
        ParticipantContact NVARCHAR(200)    NULL,
        AccessLinkId       UNIQUEIDENTIFIER NULL,
        IsHidden           BIT              NOT NULL CONSTRAINT DF_EventRegistrations_Hidden DEFAULT(0),
        SubmittedUtc       DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_EventRegistrations_Site
            FOREIGN KEY (SiteId) REFERENCES events.EventSites(Id),
        CONSTRAINT FK_EventRegistrations_Part
            FOREIGN KEY (PartId) REFERENCES events.EventParts(Id),
        CONSTRAINT FK_EventRegistrations_Link
            FOREIGN KEY (AccessLinkId) REFERENCES events.EventAccessLinks(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventRegistrations_SiteId_SubmittedUtc'
      AND object_id = OBJECT_ID('events.EventRegistrations')
)
BEGIN
    CREATE INDEX IX_EventRegistrations_SiteId_SubmittedUtc
        ON events.EventRegistrations(SiteId, SubmittedUtc);
END
GO

-- Added after the first release, so a database built from an earlier run of
-- this patch picks it up too.
IF OBJECT_ID(N'events.EventRegistrations', N'U') IS NOT NULL
   AND COL_LENGTH('events.EventRegistrations', 'IsHidden') IS NULL
BEGIN
    ALTER TABLE events.EventRegistrations
        ADD IsHidden BIT NOT NULL CONSTRAINT DF_EventRegistrations_Hidden DEFAULT(0);
END
GO

IF OBJECT_ID(N'events.EventRegistrationValues', N'U') IS NULL
BEGIN
    CREATE TABLE events.EventRegistrationValues
    (
        Id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_EventRegistrationValues PRIMARY KEY,
        RegistrationId UNIQUEIDENTIFIER NOT NULL,
        FieldId        UNIQUEIDENTIFIER NOT NULL,
        FieldLabel     NVARCHAR(300)    NOT NULL,
        Value          NVARCHAR(4000)   NULL,
        CONSTRAINT FK_EventRegistrationValues_Registration
            FOREIGN KEY (RegistrationId) REFERENCES events.EventRegistrations(Id),
        CONSTRAINT FK_EventRegistrationValues_Field
            FOREIGN KEY (FieldId) REFERENCES events.EventPartFields(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_EventRegistrationValues_RegistrationId'
      AND object_id = OBJECT_ID('events.EventRegistrationValues')
)
BEGIN
    CREATE INDEX IX_EventRegistrationValues_RegistrationId
        ON events.EventRegistrationValues(RegistrationId);
END
GO

-- ---------------------------------------------------------------------------
-- Optional cleanup, only if an earlier build was applied and left an [event2]
-- schema behind. Nothing in the running code reads it. Review before executing;
-- order matters because of the foreign keys.
--
-- DROP TABLE IF EXISTS event2.Event2RegistrationValues;
-- DROP TABLE IF EXISTS event2.Event2Registrations;
-- DROP TABLE IF EXISTS event2.Event2AccessLinkAssignments;
-- DROP TABLE IF EXISTS event2.Event2AccessLinkPages;
-- DROP TABLE IF EXISTS event2.Event2AccessLinks;
-- DROP TABLE IF EXISTS event2.Event2PartFields;
-- DROP TABLE IF EXISTS event2.Event2Parts;
-- DROP TABLE IF EXISTS event2.Event2Pages;
-- DROP TABLE IF EXISTS event2.Event2SubmissionValues;
-- DROP TABLE IF EXISTS event2.Event2Submissions;
-- DROP TABLE IF EXISTS event2.Event2InviteAssignments;
-- DROP TABLE IF EXISTS event2.Event2Invites;
-- DROP TABLE IF EXISTS event2.Event2FormFields;
-- DROP TABLE IF EXISTS event2.Event2Blocks;
-- DROP TABLE IF EXISTS event2.Event2Sites;
-- DROP SCHEMA IF EXISTS event2;
-- ---------------------------------------------------------------------------
