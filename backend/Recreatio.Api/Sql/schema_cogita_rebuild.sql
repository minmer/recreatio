/*
  Cogita rebuild schema (no compatibility layer)
  Canonical base for knowledge, checkcards, runs, answers, knowness snapshots, and statistics.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.CogitaRunEvents', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunEvents;
IF OBJECT_ID(N'dbo.CogitaKnownessSnapshots', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnownessSnapshots;
IF OBJECT_ID(N'dbo.CogitaRunExposures', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunExposures;
IF OBJECT_ID(N'dbo.CogitaRunAttempts', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunAttempts;
IF OBJECT_ID(N'dbo.CogitaRunParticipants', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunParticipants;
IF OBJECT_ID(N'dbo.CogitaRevisionRuns', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionRuns;
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionShares;
IF OBJECT_ID(N'dbo.CogitaRevisionPatterns', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionPatterns;
IF OBJECT_ID(N'dbo.CogitaDependencyEdges', N'U') IS NOT NULL DROP TABLE dbo.CogitaDependencyEdges;
IF OBJECT_ID(N'dbo.CogitaCheckcardDefinitions', N'U') IS NOT NULL DROP TABLE dbo.CogitaCheckcardDefinitions;
IF OBJECT_ID(N'dbo.CogitaKnowledgeLinkMultis', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeLinkMultis;
IF OBJECT_ID(N'dbo.CogitaKnowledgeLinkSingles', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeLinkSingles;
IF OBJECT_ID(N'dbo.CogitaKnowledgeItems', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeItems;
IF OBJECT_ID(N'dbo.CogitaKnowledgeTypeSpecs', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeTypeSpecs;
GO

CREATE TABLE dbo.CogitaKnowledgeTypeSpecs
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeTypeSpecs PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    TypeKey NVARCHAR(96) NOT NULL,
    Version INT NOT NULL,
    DisplayName NVARCHAR(256) NOT NULL,
    SpecJson NVARCHAR(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT UX_CogitaKnowledgeTypeSpecs_LibraryTypeVersion UNIQUE (LibraryId, TypeKey, Version)
);
GO

CREATE TABLE dbo.CogitaKnowledgeItems
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeItems PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    TypeSpecId UNIQUEIDENTIFIER NOT NULL,
    TypeKey NVARCHAR(96) NOT NULL,
    Title NVARCHAR(512) NOT NULL,
    SearchText NVARCHAR(MAX) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    IsExcludedFromKnowness BIT NOT NULL CONSTRAINT DF_CogitaKnowledgeItems_IsExcludedFromKnowness DEFAULT (0),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeItems_TypeSpec FOREIGN KEY (TypeSpecId) REFERENCES dbo.CogitaKnowledgeTypeSpecs(Id),
    CONSTRAINT FK_CogitaKnowledgeItems_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaKnowledgeItems_Library ON dbo.CogitaKnowledgeItems (LibraryId, UpdatedUtc DESC);
CREATE INDEX IX_CogitaKnowledgeItems_Type ON dbo.CogitaKnowledgeItems (LibraryId, TypeKey, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaKnowledgeLinkSingles
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeLinkSingles PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetItemId UNIQUEIDENTIFIER NOT NULL,
    IsRequired BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeLinkSingles_Source FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaKnowledgeLinkSingles_Target FOREIGN KEY (TargetItemId) REFERENCES dbo.CogitaKnowledgeItems(Id),
    CONSTRAINT UX_CogitaKnowledgeLinkSingles_SourceField UNIQUE (SourceItemId, FieldKey)
);
GO

CREATE TABLE dbo.CogitaKnowledgeLinkMultis
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeLinkMultis PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetItemId UNIQUEIDENTIFIER NOT NULL,
    SortOrder INT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeLinkMultis_Source FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaKnowledgeLinkMultis_Target FOREIGN KEY (TargetItemId) REFERENCES dbo.CogitaKnowledgeItems(Id),
    CONSTRAINT UX_CogitaKnowledgeLinkMultis_SourceFieldTarget UNIQUE (SourceItemId, FieldKey, TargetItemId)
);
GO

CREATE INDEX IX_CogitaKnowledgeLinkMultis_SourceFieldOrder ON dbo.CogitaKnowledgeLinkMultis (SourceItemId, FieldKey, SortOrder);
GO

CREATE TABLE dbo.CogitaCheckcardDefinitions
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCheckcardDefinitions PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    CardType NVARCHAR(64) NOT NULL,
    Direction INT NOT NULL,
    PromptJson NVARCHAR(MAX) NOT NULL,
    RevealJson NVARCHAR(MAX) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_CogitaCheckcardDefinitions_IsActive DEFAULT (1),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCheckcardDefinitions_Item FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaCheckcardDefinitions_CardKey UNIQUE (LibraryId, CardKey)
);
GO

CREATE INDEX IX_CogitaCheckcardDefinitions_Item ON dbo.CogitaCheckcardDefinitions (SourceItemId, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaDependencyEdges
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyEdges PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    ParentCardId UNIQUEIDENTIFIER NOT NULL,
    ChildCardId UNIQUEIDENTIFIER NOT NULL,
    ParentKnownessWeightPct DECIMAL(9,4) NOT NULL,
    ThresholdPct DECIMAL(9,4) NOT NULL,
    IsHardBlock BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyEdges_ParentCard FOREIGN KEY (ParentCardId) REFERENCES dbo.CogitaCheckcardDefinitions(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaDependencyEdges_ChildCard FOREIGN KEY (ChildCardId) REFERENCES dbo.CogitaCheckcardDefinitions(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaDependencyEdges_Link UNIQUE (ParentCardId, ChildCardId)
);
GO

CREATE INDEX IX_CogitaDependencyEdges_Child ON dbo.CogitaDependencyEdges (ChildCardId, ParentCardId);
GO

CREATE TABLE dbo.CogitaRevisionPatterns
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionPatterns PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(256) NOT NULL,
    Mode NVARCHAR(32) NOT NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    CollectionScopeJson NVARCHAR(MAX) NOT NULL,
    IsArchived BIT NOT NULL CONSTRAINT DF_CogitaRevisionPatterns_IsArchived DEFAULT (0),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionPatterns_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaRevisionPatterns_Library ON dbo.CogitaRevisionPatterns (LibraryId, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRevisionShares
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionShares PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RevisionPatternId UNIQUEIDENTIFIER NOT NULL,
    ShareCodeHash VARBINARY(32) NOT NULL,
    ShareCodeCipher NVARCHAR(512) NOT NULL,
    IsEnabled BIT NOT NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionShares_Pattern FOREIGN KEY (RevisionPatternId) REFERENCES dbo.CogitaRevisionPatterns(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaRevisionShares_Pattern UNIQUE (RevisionPatternId),
    CONSTRAINT UX_CogitaRevisionShares_CodeHash UNIQUE (ShareCodeHash)
);
GO

CREATE TABLE dbo.CogitaRevisionRuns
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionRuns PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RevisionPatternId UNIQUEIDENTIFIER NOT NULL,
    RunScope NVARCHAR(32) NOT NULL, /* solo|shared|group_sync|group_async */
    Title NVARCHAR(256) NULL,
    Status NVARCHAR(32) NOT NULL,
    SessionCodeHash VARBINARY(32) NULL,
    SessionCodeCipher NVARCHAR(512) NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    PromptBundleJson NVARCHAR(MAX) NULL,
    StartedUtc DATETIMEOFFSET NULL,
    FinishedUtc DATETIMEOFFSET NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionRuns_Pattern FOREIGN KEY (RevisionPatternId) REFERENCES dbo.CogitaRevisionPatterns(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaRevisionRuns_CodeHash UNIQUE (SessionCodeHash)
);
GO

CREATE INDEX IX_CogitaRevisionRuns_LibraryStatus ON dbo.CogitaRevisionRuns (LibraryId, Status, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRunParticipants
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunParticipants PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    PersonRoleId UNIQUEIDENTIFIER NULL,
    DisplayNameCipher NVARCHAR(512) NOT NULL,
    AccessTokenHash VARBINARY(32) NULL,
    AccessTokenCipher NVARCHAR(512) NULL,
    IsHost BIT NOT NULL,
    IsConnected BIT NOT NULL,
    JoinedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunParticipants_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunParticipants_PersonRole FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaRunParticipants_Run ON dbo.CogitaRunParticipants (RunId, JoinedUtc);
CREATE INDEX IX_CogitaRunParticipants_RunRole ON dbo.CogitaRunParticipants (RunId, PersonRoleId);
GO

CREATE TABLE dbo.CogitaRunAttempts
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunAttempts PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    RoundIndex INT NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    AnswerCipher NVARCHAR(MAX) NULL,
    IsAnswered BIT NOT NULL,
    IsCorrect BIT NULL,
    CorrectnessPct DECIMAL(9,4) NULL,
    SubmittedUtc DATETIMEOFFSET NOT NULL,
    RevealedUtc DATETIMEOFFSET NULL,
    ResponseDurationMs INT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunAttempts_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunAttempts_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_CogitaRunAttempts_RunParticipantRound ON dbo.CogitaRunAttempts (RunId, ParticipantId, RoundIndex, UpdatedUtc DESC);
CREATE INDEX IX_CogitaRunAttempts_RunCard ON dbo.CogitaRunAttempts (RunId, CardKey, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRunExposures
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunExposures PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    RoundIndex INT NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    PromptShownUtc DATETIMEOFFSET NOT NULL,
    RevealShownUtc DATETIMEOFFSET NULL,
    WasSkipped BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunExposures_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunExposures_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id) ON DELETE CASCADE
);
GO

CREATE INDEX IX_CogitaRunExposures_RunParticipant ON dbo.CogitaRunExposures (RunId, ParticipantId, RoundIndex);
GO

CREATE TABLE dbo.CogitaKnownessSnapshots
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnownessSnapshots PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    PersonRoleId UNIQUEIDENTIFIER NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    SnapshotUtc DATETIMEOFFSET NOT NULL,
    KnownessPct DECIMAL(9,4) NOT NULL,
    CorrectCount INT NOT NULL,
    WrongCount INT NOT NULL,
    UnansweredCount INT NOT NULL,
    LastSeenUtc DATETIMEOFFSET NULL,
    SourceRunId UNIQUEIDENTIFIER NULL,
    SourceParticipantId UNIQUEIDENTIFIER NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnownessSnapshots_PersonRole FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_CogitaKnownessSnapshots_Run FOREIGN KEY (SourceRunId) REFERENCES dbo.CogitaRevisionRuns(Id),
    CONSTRAINT FK_CogitaKnownessSnapshots_RunParticipant FOREIGN KEY (SourceParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaKnownessSnapshots_LibraryPersonCardUtc ON dbo.CogitaKnownessSnapshots (LibraryId, PersonRoleId, CardKey, SnapshotUtc DESC);
GO

CREATE TABLE dbo.CogitaRunEvents
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunEvents PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NULL,
    EventType NVARCHAR(64) NOT NULL,
    RoundIndex INT NULL,
    PayloadJson NVARCHAR(MAX) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunEvents_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunEvents_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaRunEvents_RunCreated ON dbo.CogitaRunEvents (RunId, CreatedUtc);
CREATE INDEX IX_CogitaRunEvents_ParticipantCreated ON dbo.CogitaRunEvents (ParticipantId, CreatedUtc);
GO
