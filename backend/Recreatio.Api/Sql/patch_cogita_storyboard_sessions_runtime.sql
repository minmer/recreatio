/*
  Patch: Cogita Storyboard Sessions Runtime Schema
  Purpose: add runtime session tracking tables for storyboard public session mode.
  Safe to run multiple times.
*/

IF OBJECT_ID(N'dbo.CogitaStoryboardSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaStoryboardSessions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ProjectId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        EncSessionCode VARBINARY(MAX) NOT NULL,
        EncLibraryReadKey VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        FOREIGN KEY (ProjectId) REFERENCES dbo.CogitaCreationProjects(Id),
        FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardSessions_Library_Project_Revoked' AND object_id = OBJECT_ID('dbo.CogitaStoryboardSessions'))
   AND COL_LENGTH('dbo.CogitaStoryboardSessions', 'LibraryId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessions', 'ProjectId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessions', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaStoryboardSessions_Library_Project_Revoked ON dbo.CogitaStoryboardSessions(LibraryId, ProjectId, RevokedUtc, CreatedUtc DESC);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaStoryboardSessions_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaStoryboardSessions'))
   AND COL_LENGTH('dbo.CogitaStoryboardSessions', 'PublicCodeHash') IS NOT NULL
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_CogitaStoryboardSessions_PublicCodeHash ON dbo.CogitaStoryboardSessions(PublicCodeHash);');
END
GO

IF OBJECT_ID(N'dbo.CogitaStoryboardSessionParticipants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaStoryboardSessionParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        JoinTokenHash VARBINARY(64) NOT NULL,
        UserId UNIQUEIDENTIFIER NULL,
        JoinedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        FOREIGN KEY (SessionId) REFERENCES dbo.CogitaStoryboardSessions(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaStoryboardSessionParticipants_SessionToken' AND object_id = OBJECT_ID('dbo.CogitaStoryboardSessionParticipants'))
   AND COL_LENGTH('dbo.CogitaStoryboardSessionParticipants', 'SessionId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessionParticipants', 'JoinTokenHash') IS NOT NULL
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_CogitaStoryboardSessionParticipants_SessionToken ON dbo.CogitaStoryboardSessionParticipants(SessionId, JoinTokenHash);');
END
GO

IF OBJECT_ID(N'dbo.CogitaStoryboardSessionAnswers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaStoryboardSessionAnswers
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        NodeKey NVARCHAR(256) NOT NULL,
        NotionId UNIQUEIDENTIFIER NULL,
        CheckType NVARCHAR(64) NULL,
        IsCorrect BIT NOT NULL,
        AttemptCount INT NOT NULL CONSTRAINT DF_CogitaStoryboardSessionAnswers_AttemptCount_Runtime DEFAULT (1),
        FirstSubmittedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        FOREIGN KEY (SessionId) REFERENCES dbo.CogitaStoryboardSessions(Id),
        FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaStoryboardSessionParticipants(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'AttemptCount') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaStoryboardSessionAnswers ADD AttemptCount INT NOT NULL CONSTRAINT DF_CogitaStoryboardSessionAnswers_AttemptCount_Backfill DEFAULT (1);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaStoryboardSessionAnswers_SessionParticipantNode' AND object_id = OBJECT_ID('dbo.CogitaStoryboardSessionAnswers'))
   AND COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'SessionId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'ParticipantId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'NodeKey') IS NOT NULL
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_CogitaStoryboardSessionAnswers_SessionParticipantNode ON dbo.CogitaStoryboardSessionAnswers(SessionId, ParticipantId, NodeKey);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardSessionAnswers_SessionNode' AND object_id = OBJECT_ID('dbo.CogitaStoryboardSessionAnswers'))
   AND COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'SessionId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardSessionAnswers', 'NodeKey') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaStoryboardSessionAnswers_SessionNode ON dbo.CogitaStoryboardSessionAnswers(SessionId, NodeKey);');
END
GO
