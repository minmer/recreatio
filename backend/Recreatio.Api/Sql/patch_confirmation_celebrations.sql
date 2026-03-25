IF OBJECT_ID('dbo.ParishConfirmationCelebrations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationCelebrations
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        ShortInfo NVARCHAR(320) NOT NULL,
        StartsAtUtc DATETIMEOFFSET NOT NULL,
        EndsAtUtc DATETIMEOFFSET NOT NULL,
        Description NVARCHAR(4000) NOT NULL,
        IsActive BIT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ParishConfirmationCelebrations_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT CK_ParishConfirmationCelebrations_Range CHECK (EndsAtUtc > StartsAtUtc)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationCelebrations_ParishStarts'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrations'))
BEGIN
    CREATE INDEX IX_ParishConfirmationCelebrations_ParishStarts
        ON dbo.ParishConfirmationCelebrations(ParishId, StartsAtUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationCelebrations_ParishActiveStarts'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrations'))
BEGIN
    CREATE INDEX IX_ParishConfirmationCelebrations_ParishActiveStarts
        ON dbo.ParishConfirmationCelebrations(ParishId, IsActive, StartsAtUtc);
END
GO

IF OBJECT_ID('dbo.ParishConfirmationCelebrationParticipations', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationCelebrationParticipations
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        CandidateId UNIQUEIDENTIFIER NOT NULL,
        CelebrationId UNIQUEIDENTIFIER NOT NULL,
        CommentText NVARCHAR(2000) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ParishConfirmationCelebrationParticipations_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT FK_ParishConfirmationCelebrationParticipations_Candidate FOREIGN KEY (CandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
        CONSTRAINT FK_ParishConfirmationCelebrationParticipations_Celebration FOREIGN KEY (CelebrationId) REFERENCES dbo.ParishConfirmationCelebrations(Id)
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_ParishConfirmationCelebrationParticipations_CandidateCelebration'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrationParticipations'))
BEGIN
    CREATE UNIQUE INDEX UX_ParishConfirmationCelebrationParticipations_CandidateCelebration
        ON dbo.ParishConfirmationCelebrationParticipations(CandidateId, CelebrationId);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationCelebrationParticipations_ParishCandidateUpdated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationCelebrationParticipations'))
BEGIN
    CREATE INDEX IX_ParishConfirmationCelebrationParticipations_ParishCandidateUpdated
        ON dbo.ParishConfirmationCelebrationParticipations(ParishId, CandidateId, UpdatedUtc);
END
GO
