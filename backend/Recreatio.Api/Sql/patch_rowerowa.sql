-- Rowerowa module
-- Creates the [rowerowa] schema and its two tables if they do not already exist.
-- Safe to run on an existing database; all statements are idempotent.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'rowerowa')
BEGIN
    EXEC('CREATE SCHEMA rowerowa AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'rowerowa.RowerowaEvents', N'U') IS NULL
BEGIN
    CREATE TABLE rowerowa.RowerowaEvents
    (
        Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RowerowaEvents PRIMARY KEY,
        Slug            NVARCHAR(80)     NOT NULL,
        Name            NVARCHAR(200)    NOT NULL,
        Motto           NVARCHAR(220)    NOT NULL,
        StartDate       DATE             NOT NULL,
        EndDate         DATE             NOT NULL,
        StartLocation   NVARCHAR(160)    NOT NULL,
        EndLocation     NVARCHAR(160)    NOT NULL,
        OrganizerName   NVARCHAR(160)    NOT NULL,
        OrganizerEmail  NVARCHAR(180)    NOT NULL,
        OrganizerPhone  NVARCHAR(32)     NOT NULL,
        CreatedUtc      DATETIMEOFFSET   NOT NULL,
        UpdatedUtc      DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_RowerowaEvents_Slug UNIQUE (Slug)
    );
END
GO

IF OBJECT_ID(N'rowerowa.RowerowaRegistrations', N'U') IS NULL
BEGIN
    CREATE TABLE rowerowa.RowerowaRegistrations
    (
        Id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_RowerowaRegistrations PRIMARY KEY,
        EventId              UNIQUEIDENTIFIER NOT NULL,
        FullName             NVARCHAR(200)    NOT NULL,
        Phone                NVARCHAR(32)     NOT NULL,
        Email                NVARCHAR(180)    NOT NULL,
        JoinPoint            NVARCHAR(160)    NOT NULL,
        FridayAccommodation  NVARCHAR(160)    NOT NULL,
        MealsJson            NVARCHAR(MAX)    NOT NULL,
        PostPilgrimagePlan   NVARCHAR(200)    NOT NULL,
        BikeReturn           NVARCHAR(200)    NOT NULL,
        LuggageDropoff       NVARCHAR(120)    NOT NULL,
        LuggagePickup        NVARCHAR(120)    NOT NULL,
        HasHelmet            BIT              NOT NULL,
        BikeRoadworthy       BIT              NOT NULL,
        KnowsSafetyRules     BIT              NOT NULL,
        SkillLevel           NVARCHAR(220)    NOT NULL,
        HelpOffer            NVARCHAR(2000)   NULL,
        CreatedUtc           DATETIMEOFFSET   NOT NULL,
        UpdatedUtc           DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_RowerowaRegistrations_Event
            FOREIGN KEY (EventId) REFERENCES rowerowa.RowerowaEvents(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_RowerowaRegistrations_EventCreated'
      AND object_id = OBJECT_ID('rowerowa.RowerowaRegistrations')
)
BEGIN
    CREATE INDEX IX_RowerowaRegistrations_EventCreated
        ON rowerowa.RowerowaRegistrations(EventId, CreatedUtc);
END
GO
