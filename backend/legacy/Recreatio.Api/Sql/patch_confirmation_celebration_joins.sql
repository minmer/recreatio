IF COL_LENGTH('dbo.ParishConfirmationCelebrations', 'Capacity') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationCelebrations
        ADD Capacity INT NULL;
END
GO

IF OBJECT_ID(N'dbo.CK_ParishConfirmationCelebrations_Capacity', N'C') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationCelebrations
        ADD CONSTRAINT CK_ParishConfirmationCelebrations_Capacity
            CHECK (Capacity IS NULL OR Capacity > 0);
END
GO

IF OBJECT_ID(N'dbo.ParishConfirmationCelebrationJoins', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationCelebrationJoins
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        CandidateId UNIQUEIDENTIFIER NOT NULL,
        CelebrationId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(16) NOT NULL,
        RequestedUtc DATETIMEOFFSET NOT NULL,
        DecisionUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ParishConfirmationCelebrationJoins_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT FK_ParishConfirmationCelebrationJoins_Candidate FOREIGN KEY (CandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
        CONSTRAINT FK_ParishConfirmationCelebrationJoins_Celebration FOREIGN KEY (CelebrationId) REFERENCES dbo.ParishConfirmationCelebrations(Id),
        CONSTRAINT CK_ParishConfirmationCelebrationJoins_Status CHECK (Status IN ('pending', 'accepted', 'cancelled', 'removed', 'rejected'))
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_ParishConfirmationCelebrationJoins_CandidateCelebration'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrationJoins')
)
BEGIN
    CREATE UNIQUE INDEX UX_ParishConfirmationCelebrationJoins_CandidateCelebration
        ON dbo.ParishConfirmationCelebrationJoins(CandidateId, CelebrationId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationCelebrationJoins_ParishCelebrationStatusRequested'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrationJoins')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationCelebrationJoins_ParishCelebrationStatusRequested
        ON dbo.ParishConfirmationCelebrationJoins(ParishId, CelebrationId, Status, RequestedUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationCelebrationJoins_ParishCandidateStatusUpdated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrationJoins')
)
BEGIN
    CREATE INDEX IX_ParishConfirmationCelebrationJoins_ParishCandidateStatusUpdated
        ON dbo.ParishConfirmationCelebrationJoins(ParishId, CandidateId, Status, UpdatedUtc);
END
GO
