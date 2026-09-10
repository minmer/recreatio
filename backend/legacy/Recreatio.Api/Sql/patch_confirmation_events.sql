IF OBJECT_ID(N'dbo.ParishConfirmationEvents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ParishConfirmationEvents PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        ShortInfo NVARCHAR(320) NOT NULL,
        StartsAtUtc DATETIMEOFFSET NOT NULL,
        EndsAtUtc DATETIMEOFFSET NOT NULL,
        Description NVARCHAR(4000) NOT NULL,
        Capacity INT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ParishConfirmationEvents_IsActive DEFAULT (1),
        CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_ParishConfirmationEvents_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_ParishConfirmationEvents_UpdatedUtc DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ParishConfirmationEvents_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT CK_ParishConfirmationEvents_Range CHECK (EndsAtUtc > StartsAtUtc),
        CONSTRAINT CK_ParishConfirmationEvents_Capacity CHECK (Capacity IS NULL OR Capacity > 0)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationEvents_ParishStarts'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationEvents')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationEvents_ParishStarts
        ON dbo.ParishConfirmationEvents(ParishId, StartsAtUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationEvents_ParishActiveStarts'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationEvents')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationEvents_ParishActiveStarts
        ON dbo.ParishConfirmationEvents(ParishId, IsActive, StartsAtUtc);
END
GO

IF OBJECT_ID(N'dbo.ParishConfirmationEventJoins', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationEventJoins
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_ParishConfirmationEventJoins PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        CandidateId UNIQUEIDENTIFIER NOT NULL,
        EventId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(16) NOT NULL,
        RequestedUtc DATETIMEOFFSET NOT NULL,
        DecisionUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_ParishConfirmationEventJoins_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_ParishConfirmationEventJoins_UpdatedUtc DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ParishConfirmationEventJoins_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT FK_ParishConfirmationEventJoins_Candidate FOREIGN KEY (CandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
        CONSTRAINT FK_ParishConfirmationEventJoins_Event FOREIGN KEY (EventId) REFERENCES dbo.ParishConfirmationEvents(Id),
        CONSTRAINT CK_ParishConfirmationEventJoins_Status CHECK (Status IN ('pending', 'accepted', 'cancelled', 'removed', 'rejected'))
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_ParishConfirmationEventJoins_CandidateEvent'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationEventJoins')
)
BEGIN
    CREATE UNIQUE INDEX UX_ParishConfirmationEventJoins_CandidateEvent
        ON dbo.ParishConfirmationEventJoins(CandidateId, EventId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationEventJoins_ParishEventStatusRequested'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationEventJoins')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationEventJoins_ParishEventStatusRequested
        ON dbo.ParishConfirmationEventJoins(ParishId, EventId, Status, RequestedUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationEventJoins_ParishCandidateStatusUpdated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationEventJoins')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationEventJoins_ParishCandidateStatusUpdated
        ON dbo.ParishConfirmationEventJoins(ParishId, CandidateId, Status, UpdatedUtc);
END
GO
