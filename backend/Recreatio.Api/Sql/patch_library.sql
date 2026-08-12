-- Private library module
-- Creates the [library] schema and its tables if they do not already exist.
-- Safe to run on an existing database; all statements are idempotent.
--
-- Model: Work (the creation, with its original title and language)
--        → Edition (one published realisation, original or translated)
--        → Copy (the physical item on my shelf)

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'library')
BEGIN
    EXEC('CREATE SCHEMA library AUTHORIZATION dbo;');
END
GO

-- ── Registries ──────────────────────────────────────────────────────────────

IF OBJECT_ID(N'library.LibraryPeople', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryPeople
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryPeople PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        DisplayName    NVARCHAR(240)    NOT NULL,
        SortName       NVARCHAR(240)    NULL,
        BirthYear      INT              NULL,
        DeathYear      INT              NULL,
        Nationality    NVARCHAR(80)     NULL,
        Notes          NVARCHAR(MAX)    NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL
    );
    CREATE INDEX IX_LibraryPeople_Owner_DisplayName
        ON library.LibraryPeople(OwnerAccountId, DisplayName);
END
GO

IF OBJECT_ID(N'library.LibraryPublishers', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryPublishers
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryPublishers PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        Name           NVARCHAR(240)    NOT NULL,
        City           NVARCHAR(160)    NULL,
        Notes          NVARCHAR(MAX)    NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL
    );
    CREATE INDEX IX_LibraryPublishers_Owner_Name
        ON library.LibraryPublishers(OwnerAccountId, Name);
END
GO

IF OBJECT_ID(N'library.LibraryShelves', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryShelves
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryShelves PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        Name           NVARCHAR(160)    NOT NULL,
        Location       NVARCHAR(240)    NULL,
        Description    NVARCHAR(MAX)    NULL,
        SortOrder      INT              NOT NULL CONSTRAINT DF_LibraryShelves_SortOrder DEFAULT(0),
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL
    );
    CREATE INDEX IX_LibraryShelves_Owner_SortOrder
        ON library.LibraryShelves(OwnerAccountId, SortOrder);
END
GO

IF OBJECT_ID(N'library.LibraryTags', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryTags
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryTags PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        Name           NVARCHAR(120)    NOT NULL,
        Color          NVARCHAR(16)     NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_LibraryTags_Owner_Name UNIQUE (OwnerAccountId, Name)
    );
END
GO

-- ── Works, editions, copies ─────────────────────────────────────────────────

IF OBJECT_ID(N'library.LibraryWorks', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryWorks
    (
        Id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryWorks PRIMARY KEY,
        OwnerAccountId     UNIQUEIDENTIFIER NOT NULL,
        OriginalTitle      NVARCHAR(400)    NOT NULL,
        OriginalSubtitle   NVARCHAR(400)    NULL,
        OriginalLanguage   NVARCHAR(16)     NOT NULL,
        UniformTitle       NVARCHAR(400)    NULL,
        Kind               NVARCHAR(32)     NOT NULL CONSTRAINT DF_LibraryWorks_Kind DEFAULT('book'),
        FirstPublishedYear INT              NULL,
        Notes              NVARCHAR(MAX)    NULL,
        CreatedUtc         DATETIMEOFFSET   NOT NULL,
        UpdatedUtc         DATETIMEOFFSET   NOT NULL
    );
    CREATE INDEX IX_LibraryWorks_Owner_OriginalTitle
        ON library.LibraryWorks(OwnerAccountId, OriginalTitle);
    CREATE INDEX IX_LibraryWorks_Owner_OriginalLanguage
        ON library.LibraryWorks(OwnerAccountId, OriginalLanguage);
END
GO

IF OBJECT_ID(N'library.LibraryEditions', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryEditions
    (
        Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryEditions PRIMARY KEY,
        OwnerAccountId   UNIQUEIDENTIFIER NOT NULL,
        WorkId           BIGINT           NOT NULL,
        Title            NVARCHAR(400)    NOT NULL,
        Subtitle         NVARCHAR(400)    NULL,
        Language         NVARCHAR(16)     NOT NULL,
        PublisherId      BIGINT           NULL,
        PublishedPlace   NVARCHAR(160)    NULL,
        PublishedYear    INT              NULL,
        EditionStatement NVARCHAR(160)    NULL,
        Series           NVARCHAR(200)    NULL,
        SeriesNumber     NVARCHAR(60)     NULL,
        Isbn             NVARCHAR(32)     NULL,
        Issn             NVARCHAR(32)     NULL,
        PageCount        INT              NULL,
        Volume           NVARCHAR(60)     NULL,
        Binding          NVARCHAR(40)     NULL,
        CoverUrl         NVARCHAR(500)    NULL,
        Notes            NVARCHAR(MAX)    NULL,
        CreatedUtc       DATETIMEOFFSET   NOT NULL,
        UpdatedUtc       DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_LibraryEditions_Work
            FOREIGN KEY (WorkId) REFERENCES library.LibraryWorks(Id)
    );
    CREATE INDEX IX_LibraryEditions_Owner_Work      ON library.LibraryEditions(OwnerAccountId, WorkId);
    CREATE INDEX IX_LibraryEditions_Owner_Language  ON library.LibraryEditions(OwnerAccountId, Language);
    CREATE INDEX IX_LibraryEditions_Owner_Publisher ON library.LibraryEditions(OwnerAccountId, PublisherId);
END
GO

IF OBJECT_ID(N'library.LibraryContributions', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryContributions
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryContributions PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        PersonId       BIGINT           NOT NULL,
        TargetType     NVARCHAR(16)     NOT NULL,   -- work | edition
        TargetId       BIGINT           NOT NULL,
        Role           NVARCHAR(32)     NOT NULL,   -- author | translator | editor | ...
        SortOrder      INT              NOT NULL CONSTRAINT DF_LibraryContributions_SortOrder DEFAULT(0),
        CreatedUtc     DATETIMEOFFSET   NOT NULL
    );
    CREATE INDEX IX_LibraryContributions_Owner_Target
        ON library.LibraryContributions(OwnerAccountId, TargetType, TargetId);
    CREATE INDEX IX_LibraryContributions_Owner_Person
        ON library.LibraryContributions(OwnerAccountId, PersonId);
END
GO

IF OBJECT_ID(N'library.LibraryCopies', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryCopies
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryCopies PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        EditionId      BIGINT           NOT NULL,
        ShelfId        BIGINT           NULL,
        Signature      NVARCHAR(80)     NULL,
        Status         NVARCHAR(24)     NOT NULL CONSTRAINT DF_LibraryCopies_Status DEFAULT('shelf'),
        Condition      NVARCHAR(24)     NULL,
        AcquiredDate   DATE             NULL,
        AcquiredFrom   NVARCHAR(200)    NULL,
        Price          DECIMAL(10,2)    NULL,
        Currency       NVARCHAR(8)      NULL,
        Barcode        NVARCHAR(64)     NULL,
        ReadingStatus  NVARCHAR(24)     NOT NULL CONSTRAINT DF_LibraryCopies_ReadingStatus DEFAULT('unread'),
        Rating         INT              NULL,
        IsFavourite    BIT              NOT NULL CONSTRAINT DF_LibraryCopies_IsFavourite DEFAULT(0),
        Notes          NVARCHAR(MAX)    NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_LibraryCopies_Edition
            FOREIGN KEY (EditionId) REFERENCES library.LibraryEditions(Id)
    );
    CREATE INDEX IX_LibraryCopies_Owner_Edition ON library.LibraryCopies(OwnerAccountId, EditionId);
    CREATE INDEX IX_LibraryCopies_Owner_Shelf   ON library.LibraryCopies(OwnerAccountId, ShelfId);
    CREATE INDEX IX_LibraryCopies_Owner_Reading ON library.LibraryCopies(OwnerAccountId, ReadingStatus);
END
GO

-- ── Activity ────────────────────────────────────────────────────────────────

IF OBJECT_ID(N'library.LibraryLoans', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryLoans
    (
        Id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryLoans PRIMARY KEY,
        OwnerAccountId     UNIQUEIDENTIFIER NOT NULL,
        CopyId             BIGINT           NOT NULL,
        Direction          NVARCHAR(16)     NOT NULL,   -- out = lent away, in = borrowed
        CounterpartName    NVARCHAR(200)    NOT NULL,
        CounterpartContact NVARCHAR(200)    NULL,
        LentOn             DATE             NOT NULL,
        DueOn              DATE             NULL,
        ReturnedOn         DATE             NULL,
        Notes              NVARCHAR(MAX)    NULL,
        CreatedUtc         DATETIMEOFFSET   NOT NULL,
        UpdatedUtc         DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_LibraryLoans_Copy
            FOREIGN KEY (CopyId) REFERENCES library.LibraryCopies(Id)
    );
    CREATE INDEX IX_LibraryLoans_Owner_Copy_Returned
        ON library.LibraryLoans(OwnerAccountId, CopyId, ReturnedOn);
END
GO

IF OBJECT_ID(N'library.LibraryReadings', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryReadings
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryReadings PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        CopyId         BIGINT           NOT NULL,
        StartedOn      DATE             NULL,
        FinishedOn     DATE             NULL,
        Rating         INT              NULL,
        Notes          NVARCHAR(MAX)    NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        UpdatedUtc     DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_LibraryReadings_Copy
            FOREIGN KEY (CopyId) REFERENCES library.LibraryCopies(Id)
    );
    CREATE INDEX IX_LibraryReadings_Owner_Copy
        ON library.LibraryReadings(OwnerAccountId, CopyId);
END
GO

IF OBJECT_ID(N'library.LibraryWorkTags', N'U') IS NULL
BEGIN
    CREATE TABLE library.LibraryWorkTags
    (
        Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryWorkTags PRIMARY KEY,
        OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
        WorkId         BIGINT           NOT NULL,
        TagId          BIGINT           NOT NULL,
        CreatedUtc     DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_LibraryWorkTags_Work FOREIGN KEY (WorkId) REFERENCES library.LibraryWorks(Id),
        CONSTRAINT FK_LibraryWorkTags_Tag  FOREIGN KEY (TagId)  REFERENCES library.LibraryTags(Id),
        CONSTRAINT UX_LibraryWorkTags_Owner_Work_Tag UNIQUE (OwnerAccountId, WorkId, TagId)
    );
    CREATE INDEX IX_LibraryWorkTags_Owner_Tag
        ON library.LibraryWorkTags(OwnerAccountId, TagId);
END
GO
