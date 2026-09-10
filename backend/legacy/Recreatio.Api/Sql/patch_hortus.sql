-- Hortus Dei reservation module
-- Creates the [hortus] schema and its five tables if they do not already exist.
-- Safe to run on an existing database; all statements are idempotent.

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'hortus')
BEGIN
    EXEC('CREATE SCHEMA hortus AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'hortus.HortusPlaces', N'U') IS NULL
BEGIN
    CREATE TABLE hortus.HortusPlaces
    (
        Id                      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HortusPlaces PRIMARY KEY,
        Slug                    NVARCHAR(80)     NOT NULL,
        Name                    NVARCHAR(200)    NOT NULL,
        Motto                   NVARCHAR(300)    NOT NULL,
        Description             NVARCHAR(4000)   NOT NULL,
        AddressLine             NVARCHAR(300)    NOT NULL,
        ContactName             NVARCHAR(160)    NOT NULL,
        ContactEmail            NVARCHAR(180)    NOT NULL,
        ContactPhone            NVARCHAR(32)     NOT NULL,
        TimeZoneId              NVARCHAR(80)     NOT NULL,
        CheckInTime             TIME             NOT NULL,
        CheckOutTime            TIME             NOT NULL,
        DefaultTechnicalMinutes INT              NOT NULL,
        MinLeadDays             INT              NOT NULL,
        PublicRequestsEnabled   BIT              NOT NULL,
        CreatedUtc              DATETIMEOFFSET   NOT NULL,
        UpdatedUtc              DATETIMEOFFSET   NOT NULL,
        CONSTRAINT UX_HortusPlaces_Slug UNIQUE (Slug)
    );
END
GO

-- Parts of the place, nested: whole place > house > chapel / dining room, garden > grill.
-- Capacity is how many different groups may hold the part at the same moment.
IF OBJECT_ID(N'hortus.HortusResources', N'U') IS NULL
BEGIN
    CREATE TABLE hortus.HortusResources
    (
        Id                      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HortusResources PRIMARY KEY,
        PlaceId                 UNIQUEIDENTIFIER NOT NULL,
        ParentId                UNIQUEIDENTIFIER NULL,
        Slug                    NVARCHAR(80)     NOT NULL,
        Name                    NVARCHAR(200)    NOT NULL,
        Description             NVARCHAR(2000)   NOT NULL,
        Kind                    NVARCHAR(32)     NOT NULL,
        BookingUnit             NVARCHAR(16)     NOT NULL,
        Capacity                INT              NOT NULL,
        GuestCapacity           INT              NULL,
        TechnicalMinutesBefore  INT              NOT NULL,
        TechnicalMinutesAfter   INT              NOT NULL,
        IsPubliclyBookable      BIT              NOT NULL,
        IsActive                BIT              NOT NULL,
        SortOrder               INT              NOT NULL,
        ColorToken              NVARCHAR(16)     NOT NULL,
        CreatedUtc              DATETIMEOFFSET   NOT NULL,
        UpdatedUtc              DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_HortusResources_Place
            FOREIGN KEY (PlaceId) REFERENCES hortus.HortusPlaces(Id),
        CONSTRAINT FK_HortusResources_Parent
            FOREIGN KEY (ParentId) REFERENCES hortus.HortusResources(Id),
        CONSTRAINT UX_HortusResources_PlaceSlug UNIQUE (PlaceId, Slug)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_HortusResources_ParentId'
      AND object_id = OBJECT_ID('hortus.HortusResources')
)
BEGIN
    CREATE INDEX IX_HortusResources_ParentId ON hortus.HortusResources(ParentId);
END
GO

IF OBJECT_ID(N'hortus.HortusReservations', N'U') IS NULL
BEGIN
    CREATE TABLE hortus.HortusReservations
    (
        Id                  UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HortusReservations PRIMARY KEY,
        PlaceId             UNIQUEIDENTIFIER NOT NULL,
        Code                NVARCHAR(16)     NOT NULL,
        Kind                NVARCHAR(16)     NOT NULL,
        Status              NVARCHAR(16)     NOT NULL,
        GroupName           NVARCHAR(200)    NOT NULL,
        Organization        NVARCHAR(200)    NOT NULL,
        ContactName         NVARCHAR(200)    NOT NULL,
        ContactEmail        NVARCHAR(180)    NOT NULL,
        ContactPhone        NVARCHAR(32)     NOT NULL,
        GuestCount          INT              NULL,
        PurposeNote         NVARCHAR(2000)   NULL,
        AdminNote           NVARCHAR(2000)   NULL,
        RequesterTokenHash  NVARCHAR(64)     NULL,
        RequestedByUserId   UNIQUEIDENTIFIER NULL,
        DecidedByUserId     UNIQUEIDENTIFIER NULL,
        DecidedUtc          DATETIMEOFFSET   NULL,
        CreatedUtc          DATETIMEOFFSET   NOT NULL,
        UpdatedUtc          DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_HortusReservations_Place
            FOREIGN KEY (PlaceId) REFERENCES hortus.HortusPlaces(Id),
        CONSTRAINT UX_HortusReservations_Code UNIQUE (Code)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_HortusReservations_PlaceStatusCreated'
      AND object_id = OBJECT_ID('hortus.HortusReservations')
)
BEGIN
    CREATE INDEX IX_HortusReservations_PlaceStatusCreated
        ON hortus.HortusReservations(PlaceId, Status, CreatedUtc);
END
GO

-- One part held over one interval. StartUtc/EndUtc is when the group is present; the technical
-- minutes on either side are what keeps the next group out while the part is being cleaned.
IF OBJECT_ID(N'hortus.HortusReservationItems', N'U') IS NULL
BEGIN
    CREATE TABLE hortus.HortusReservationItems
    (
        Id                      UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HortusReservationItems PRIMARY KEY,
        ReservationId           UNIQUEIDENTIFIER NOT NULL,
        ResourceId              UNIQUEIDENTIFIER NOT NULL,
        Unit                    NVARCHAR(16)     NOT NULL,
        StartDate               DATE             NOT NULL,
        EndDate                 DATE             NOT NULL,
        StartUtc                DATETIMEOFFSET   NOT NULL,
        EndUtc                  DATETIMEOFFSET   NOT NULL,
        TechnicalMinutesBefore  INT              NOT NULL,
        TechnicalMinutesAfter   INT              NOT NULL,
        IsExclusive             BIT              NOT NULL,
        Note                    NVARCHAR(400)    NULL,
        CONSTRAINT FK_HortusReservationItems_Reservation
            FOREIGN KEY (ReservationId) REFERENCES hortus.HortusReservations(Id),
        CONSTRAINT FK_HortusReservationItems_Resource
            FOREIGN KEY (ResourceId) REFERENCES hortus.HortusResources(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_HortusReservationItems_ResourceRange'
      AND object_id = OBJECT_ID('hortus.HortusReservationItems')
)
BEGIN
    CREATE INDEX IX_HortusReservationItems_ResourceRange
        ON hortus.HortusReservationItems(ResourceId, StartUtc, EndUtc);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_HortusReservationItems_ReservationId'
      AND object_id = OBJECT_ID('hortus.HortusReservationItems')
)
BEGIN
    CREATE INDEX IX_HortusReservationItems_ReservationId
        ON hortus.HortusReservationItems(ReservationId);
END
GO

IF OBJECT_ID(N'hortus.HortusReservationStatusLogs', N'U') IS NULL
BEGIN
    CREATE TABLE hortus.HortusReservationStatusLogs
    (
        Id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_HortusReservationStatusLogs PRIMARY KEY,
        ReservationId   UNIQUEIDENTIFIER NOT NULL,
        FromStatus      NVARCHAR(16)     NOT NULL,
        ToStatus        NVARCHAR(16)     NOT NULL,
        ChangedByUserId UNIQUEIDENTIFIER NULL,
        Note            NVARCHAR(400)    NULL,
        CreatedUtc      DATETIMEOFFSET   NOT NULL,
        CONSTRAINT FK_HortusReservationStatusLogs_Reservation
            FOREIGN KEY (ReservationId) REFERENCES hortus.HortusReservations(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_HortusReservationStatusLogs_ReservationCreated'
      AND object_id = OBJECT_ID('hortus.HortusReservationStatusLogs')
)
BEGIN
    CREATE INDEX IX_HortusReservationStatusLogs_ReservationCreated
        ON hortus.HortusReservationStatusLogs(ReservationId, CreatedUtc);
END
GO
