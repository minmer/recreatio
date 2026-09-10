-- ===========================================================================
-- Private library — citation-capable schema
-- ===========================================================================
--
-- Two concerns are kept strictly apart:
--
--   Citation layer   Work → Expression → Manifestation
--                    what a footnote points at
--   Physical layer   Manifestation → Item → Shelf
--                    where the book stands in the room
--
-- A Quote references a Work (always), and optionally an Expression (which
-- translation) and a Manifestation (which printing). It never references an
-- Item: a citation must survive selling the book, and must work for a book
-- that was never owned.
--
-- ---------------------------------------------------------------------------
-- DESTRUCTIVE: the block below drops the previous library tables. It is here
-- because the catalogue was confirmed empty. Remove it before running against
-- a database that holds real books.
-- ---------------------------------------------------------------------------

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'library')
BEGIN
    EXEC('CREATE SCHEMA library AUTHORIZATION dbo;');
END
GO

-- Children first so foreign keys unwind cleanly.
-- OBJECT_ID checks are used instead of DROP TABLE IF EXISTS for compatibility
-- with SQL Server versions that predate SQL Server 2016.
IF OBJECT_ID(N'library.LibraryQuoteTags', N'U') IS NOT NULL DROP TABLE library.LibraryQuoteTags;
IF OBJECT_ID(N'library.LibraryQuotes', N'U') IS NOT NULL DROP TABLE library.LibraryQuotes;
IF OBJECT_ID(N'library.LibraryLoans', N'U') IS NOT NULL DROP TABLE library.LibraryLoans;
IF OBJECT_ID(N'library.LibraryReadings', N'U') IS NOT NULL DROP TABLE library.LibraryReadings;
IF OBJECT_ID(N'library.LibraryItems', N'U') IS NOT NULL DROP TABLE library.LibraryItems;
IF OBJECT_ID(N'library.LibraryCopies', N'U') IS NOT NULL DROP TABLE library.LibraryCopies;
IF OBJECT_ID(N'library.LibraryPlacementGroups', N'U') IS NOT NULL DROP TABLE library.LibraryPlacementGroups;
IF OBJECT_ID(N'library.LibraryManifestations', N'U') IS NOT NULL DROP TABLE library.LibraryManifestations;
IF OBJECT_ID(N'library.LibraryEditions', N'U') IS NOT NULL DROP TABLE library.LibraryEditions;
IF OBJECT_ID(N'library.LibraryExpressions', N'U') IS NOT NULL DROP TABLE library.LibraryExpressions;
IF OBJECT_ID(N'library.LibraryContributions', N'U') IS NOT NULL DROP TABLE library.LibraryContributions;
IF OBJECT_ID(N'library.LibraryWorkTags', N'U') IS NOT NULL DROP TABLE library.LibraryWorkTags;
IF OBJECT_ID(N'library.LibraryWorks', N'U') IS NOT NULL DROP TABLE library.LibraryWorks;
IF OBJECT_ID(N'library.LibraryTags', N'U') IS NOT NULL DROP TABLE library.LibraryTags;
IF OBJECT_ID(N'library.LibraryShelves', N'U') IS NOT NULL DROP TABLE library.LibraryShelves;
IF OBJECT_ID(N'library.LibraryPublishers', N'U') IS NOT NULL DROP TABLE library.LibraryPublishers;
IF OBJECT_ID(N'library.LibraryPeople', N'U') IS NOT NULL DROP TABLE library.LibraryPeople;
GO

-- ── Registries ─────────────────────────────────────────────────────────────

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
CREATE INDEX IX_LibraryPeople_Owner_DisplayName ON library.LibraryPeople(OwnerAccountId, DisplayName);
GO

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
CREATE INDEX IX_LibraryPublishers_Owner_Name ON library.LibraryPublishers(OwnerAccountId, Name);
GO

-- Shelves carry physical constraints so the arrangement service can check fit.
CREATE TABLE library.LibraryShelves
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryShelves PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    Name           NVARCHAR(160)    NOT NULL,
    Location       NVARCHAR(240)    NULL,
    Description    NVARCHAR(MAX)    NULL,
    SortOrder      INT              NOT NULL CONSTRAINT DF_LibraryShelves_SortOrder DEFAULT(0),
    HeightMm       INT              NULL,
    DepthMm        INT              NULL,
    WidthMm        INT              NULL,
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    UpdatedUtc     DATETIMEOFFSET   NOT NULL
);
CREATE INDEX IX_LibraryShelves_Owner_SortOrder ON library.LibraryShelves(OwnerAccountId, SortOrder);
GO

-- One tag vocabulary, shared by works and quotes.
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
GO

-- ── Citation layer ─────────────────────────────────────────────────────────

-- The abstract creation. CitationScheme decides which locator fields apply and
-- which formatter renders them; it is a string, not an enum column, so a new
-- scheme needs a new formatter class and no migration.
CREATE TABLE library.LibraryWorks
(
    Id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryWorks PRIMARY KEY,
    OwnerAccountId     UNIQUEIDENTIFIER NOT NULL,
    OriginalTitle      NVARCHAR(400)    NOT NULL,
    OriginalSubtitle   NVARCHAR(400)    NULL,
    OriginalLanguage   NVARCHAR(16)     NOT NULL,
    UniformTitle       NVARCHAR(400)    NULL,
    -- Browsing category: book | article | essay | poetry | drama | treatise |
    -- collection | reference | scripture | document | other
    Kind               NVARCHAR(32)     NOT NULL CONSTRAINT DF_LibraryWorks_Kind DEFAULT('book'),
    -- Citation behaviour: Page | BibleReference | StructuredWork | DocumentParagraph
    CitationScheme     NVARCHAR(32)     NOT NULL CONSTRAINT DF_LibraryWorks_Scheme DEFAULT('Page'),
    -- Ordered part definitions for StructuredWork, e.g.
    -- [{"key":"part","abbr":""},{"key":"question","abbr":"q."},{"key":"article","abbr":"a."}]
    StructureTemplateJson NVARCHAR(MAX) NULL,
    -- Short sigil used in front of structured locators, e.g. "STh".
    CitationSigil      NVARCHAR(40)     NULL,
    FirstPublishedYear INT              NULL,
    Notes              NVARCHAR(MAX)    NULL,
    CreatedUtc         DATETIMEOFFSET   NOT NULL,
    UpdatedUtc         DATETIMEOFFSET   NOT NULL
);
CREATE INDEX IX_LibraryWorks_Owner_OriginalTitle ON library.LibraryWorks(OwnerAccountId, OriginalTitle);
CREATE INDEX IX_LibraryWorks_Owner_Scheme        ON library.LibraryWorks(OwnerAccountId, CitationScheme);
GO

-- A language version of a Work: a translation, or the original-language text
-- when it needs naming ("Marietti edition"). Optional per Work.
CREATE TABLE library.LibraryExpressions
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryExpressions PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    WorkId         BIGINT           NOT NULL,
    Language       NVARCHAR(16)     NOT NULL,
    Name           NVARCHAR(240)    NULL,
    Notes          NVARCHAR(MAX)    NULL,
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    UpdatedUtc     DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryExpressions_Work FOREIGN KEY (WorkId) REFERENCES library.LibraryWorks(Id)
);
CREATE INDEX IX_LibraryExpressions_Owner_Work ON library.LibraryExpressions(OwnerAccountId, WorkId);
GO

-- A concrete published form: a printing, a web page, or an ebook.
-- Hangs off an Expression when one exists, otherwise straight off the Work.
CREATE TABLE library.LibraryManifestations
(
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryManifestations PRIMARY KEY,
    OwnerAccountId   UNIQUEIDENTIFIER NOT NULL,
    WorkId           BIGINT           NULL,
    ExpressionId     BIGINT           NULL,
    -- Print | Web | Ebook
    Format           NVARCHAR(16)     NOT NULL CONSTRAINT DF_LibraryManifestations_Format DEFAULT('Print'),
    Title            NVARCHAR(400)    NOT NULL,
    Subtitle         NVARCHAR(400)    NULL,
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
    Url              NVARCHAR(1000)   NULL,
    -- Where the original text can be read, when that is not the cited object.
    OriginalTextUrl  NVARCHAR(1000)   NULL,
    CoverImageUrl    NVARCHAR(1000)   NULL,
    HeightMm         INT              NULL,
    WidthMm          INT              NULL,
    DepthMm          INT              NULL,
    Notes            NVARCHAR(MAX)    NULL,
    CreatedUtc       DATETIMEOFFSET   NOT NULL,
    UpdatedUtc       DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryManifestations_Work       FOREIGN KEY (WorkId)       REFERENCES library.LibraryWorks(Id),
    CONSTRAINT FK_LibraryManifestations_Expression FOREIGN KEY (ExpressionId) REFERENCES library.LibraryExpressions(Id),
    CONSTRAINT FK_LibraryManifestations_Publisher  FOREIGN KEY (PublisherId)  REFERENCES library.LibraryPublishers(Id),
    -- Must be reachable from a Work one way or the other.
    CONSTRAINT CK_LibraryManifestations_Parent CHECK (WorkId IS NOT NULL OR ExpressionId IS NOT NULL)
);
CREATE INDEX IX_LibraryManifestations_Owner_Work       ON library.LibraryManifestations(OwnerAccountId, WorkId);
CREATE INDEX IX_LibraryManifestations_Owner_Expression ON library.LibraryManifestations(OwnerAccountId, ExpressionId);
CREATE INDEX IX_LibraryManifestations_Owner_Publisher  ON library.LibraryManifestations(OwnerAccountId, PublisherId);
CREATE INDEX IX_LibraryManifestations_Owner_Isbn       ON library.LibraryManifestations(OwnerAccountId, Isbn) WHERE Isbn IS NOT NULL;
GO

-- Person ↔ work | expression | manifestation, in a named role.
-- Authorship sits on the work, translation on the expression, illustration and
-- editing usually on the manifestation.
CREATE TABLE library.LibraryContributions
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryContributions PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    PersonId       BIGINT           NOT NULL,
    TargetType     NVARCHAR(16)     NOT NULL,   -- work | expression | manifestation
    TargetId       BIGINT           NOT NULL,
    Role           NVARCHAR(32)     NOT NULL,
    SortOrder      INT              NOT NULL CONSTRAINT DF_LibraryContributions_SortOrder DEFAULT(0),
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryContributions_Person FOREIGN KEY (PersonId) REFERENCES library.LibraryPeople(Id)
);
CREATE INDEX IX_LibraryContributions_Owner_Target ON library.LibraryContributions(OwnerAccountId, TargetType, TargetId);
CREATE INDEX IX_LibraryContributions_Owner_Person ON library.LibraryContributions(OwnerAccountId, PersonId);
GO

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
CREATE INDEX IX_LibraryWorkTags_Owner_Tag ON library.LibraryWorkTags(OwnerAccountId, TagId);
GO

-- ── Quotes ─────────────────────────────────────────────────────────────────

-- LocatorJson holds the structured, scheme-dependent position.
-- LocatorDisplay is the rendered form, denormalised so search and display never
-- have to parse JSON. Description and Context are optional throughout: a bare
-- quote is text plus a work.
CREATE TABLE library.LibraryQuotes
(
    Id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryQuotes PRIMARY KEY,
    OwnerAccountId  UNIQUEIDENTIFIER NOT NULL,
    WorkId          BIGINT           NOT NULL,
    ExpressionId    BIGINT           NULL,
    ManifestationId BIGINT           NULL,
    QuoteText       NVARCHAR(MAX)    NOT NULL,
    LocatorJson     NVARCHAR(MAX)    NULL,
    LocatorDisplay  NVARCHAR(200)    NULL,
    Description     NVARCHAR(MAX)    NULL,
    Context         NVARCHAR(MAX)    NULL,
    CreatedUtc      DATETIMEOFFSET   NOT NULL,
    UpdatedUtc      DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryQuotes_Work          FOREIGN KEY (WorkId)          REFERENCES library.LibraryWorks(Id),
    CONSTRAINT FK_LibraryQuotes_Expression    FOREIGN KEY (ExpressionId)    REFERENCES library.LibraryExpressions(Id),
    CONSTRAINT FK_LibraryQuotes_Manifestation FOREIGN KEY (ManifestationId) REFERENCES library.LibraryManifestations(Id)
);
CREATE INDEX IX_LibraryQuotes_Owner_Work    ON library.LibraryQuotes(OwnerAccountId, WorkId);
CREATE INDEX IX_LibraryQuotes_Owner_Created ON library.LibraryQuotes(OwnerAccountId, CreatedUtc DESC);
CREATE INDEX IX_LibraryQuotes_Owner_Locator ON library.LibraryQuotes(OwnerAccountId, LocatorDisplay);
GO

CREATE TABLE library.LibraryQuoteTags
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryQuoteTags PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    QuoteId        BIGINT           NOT NULL,
    TagId          BIGINT           NOT NULL,
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryQuoteTags_Quote FOREIGN KEY (QuoteId) REFERENCES library.LibraryQuotes(Id),
    CONSTRAINT FK_LibraryQuoteTags_Tag   FOREIGN KEY (TagId)   REFERENCES library.LibraryTags(Id),
    CONSTRAINT UX_LibraryQuoteTags_Owner_Quote_Tag UNIQUE (OwnerAccountId, QuoteId, TagId)
);
CREATE INDEX IX_LibraryQuoteTags_Owner_Tag ON library.LibraryQuoteTags(OwnerAccountId, TagId);
GO

-- ── Physical layer ─────────────────────────────────────────────────────────

-- Grouping constraint honoured by the arrangement heuristic.
CREATE TABLE library.LibraryPlacementGroups
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryPlacementGroups PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    Name           NVARCHAR(200)    NOT NULL,
    -- series = fixed order, collection = adjacent but any order, free = unconstrained
    GroupKind      NVARCHAR(16)     NOT NULL CONSTRAINT DF_LibraryPlacementGroups_Kind DEFAULT('collection'),
    Notes          NVARCHAR(MAX)    NULL,
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    UpdatedUtc     DATETIMEOFFSET   NOT NULL
);
CREATE INDEX IX_LibraryPlacementGroups_Owner ON library.LibraryPlacementGroups(OwnerAccountId, Name);
GO

-- My physical copy. Optional throughout: a Work or Manifestation can exist with
-- no Item at all, which is what makes citing a book I do not own possible.
CREATE TABLE library.LibraryItems
(
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryItems PRIMARY KEY,
    OwnerAccountId   UNIQUEIDENTIFIER NOT NULL,
    ManifestationId  BIGINT           NOT NULL,
    ShelfId          BIGINT           NULL,
    PlacementGroupId BIGINT           NULL,
    PositionInShelf  INT              NULL,
    -- Position inside an ordered series, independent of shelf placement.
    SeriesPosition   INT              NULL,
    Signature        NVARCHAR(80)     NULL,
    Status           NVARCHAR(24)     NOT NULL CONSTRAINT DF_LibraryItems_Status DEFAULT('shelf'),
    Condition        NVARCHAR(24)     NULL,
    AcquiredDate     DATE             NULL,
    AcquiredFrom     NVARCHAR(200)    NULL,
    Price            DECIMAL(10,2)    NULL,
    Currency         NVARCHAR(8)      NULL,
    Barcode          NVARCHAR(64)     NULL,
    ReadingStatus    NVARCHAR(24)     NOT NULL CONSTRAINT DF_LibraryItems_Reading DEFAULT('unread'),
    Rating           INT              NULL,
    IsFavourite      BIT              NOT NULL CONSTRAINT DF_LibraryItems_Favourite DEFAULT(0),
    -- User-supplied scan, used when no cover could be fetched.
    ScanImageUrl     NVARCHAR(1000)   NULL,
    Notes            NVARCHAR(MAX)    NULL,
    CreatedUtc       DATETIMEOFFSET   NOT NULL,
    UpdatedUtc       DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryItems_Manifestation  FOREIGN KEY (ManifestationId)  REFERENCES library.LibraryManifestations(Id),
    CONSTRAINT FK_LibraryItems_Shelf          FOREIGN KEY (ShelfId)          REFERENCES library.LibraryShelves(Id),
    CONSTRAINT FK_LibraryItems_PlacementGroup FOREIGN KEY (PlacementGroupId) REFERENCES library.LibraryPlacementGroups(Id)
);
CREATE INDEX IX_LibraryItems_Owner_Manifestation ON library.LibraryItems(OwnerAccountId, ManifestationId);
CREATE INDEX IX_LibraryItems_Owner_Shelf_Pos     ON library.LibraryItems(OwnerAccountId, ShelfId, PositionInShelf);
CREATE INDEX IX_LibraryItems_Owner_Group         ON library.LibraryItems(OwnerAccountId, PlacementGroupId);
CREATE INDEX IX_LibraryItems_Owner_Reading       ON library.LibraryItems(OwnerAccountId, ReadingStatus);
GO

CREATE TABLE library.LibraryLoans
(
    Id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryLoans PRIMARY KEY,
    OwnerAccountId     UNIQUEIDENTIFIER NOT NULL,
    ItemId             BIGINT           NOT NULL,
    Direction          NVARCHAR(16)     NOT NULL,   -- out = lent away, in = borrowed
    CounterpartName    NVARCHAR(200)    NOT NULL,
    CounterpartContact NVARCHAR(200)    NULL,
    LentOn             DATE             NOT NULL,
    DueOn              DATE             NULL,
    ReturnedOn         DATE             NULL,
    Notes              NVARCHAR(MAX)    NULL,
    CreatedUtc         DATETIMEOFFSET   NOT NULL,
    UpdatedUtc         DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryLoans_Item FOREIGN KEY (ItemId) REFERENCES library.LibraryItems(Id)
);
CREATE INDEX IX_LibraryLoans_Owner_Item_Returned ON library.LibraryLoans(OwnerAccountId, ItemId, ReturnedOn);
GO

CREATE TABLE library.LibraryReadings
(
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_LibraryReadings PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    ItemId         BIGINT           NOT NULL,
    StartedOn      DATE             NULL,
    FinishedOn     DATE             NULL,
    Rating         INT              NULL,
    Notes          NVARCHAR(MAX)    NULL,
    CreatedUtc     DATETIMEOFFSET   NOT NULL,
    UpdatedUtc     DATETIMEOFFSET   NOT NULL,
    CONSTRAINT FK_LibraryReadings_Item FOREIGN KEY (ItemId) REFERENCES library.LibraryItems(Id)
);
CREATE INDEX IX_LibraryReadings_Owner_Item ON library.LibraryReadings(OwnerAccountId, ItemId);
GO
