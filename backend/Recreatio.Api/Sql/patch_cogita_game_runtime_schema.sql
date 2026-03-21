/*
  Patch: Cogita Game Runtime schema
  Applies idempotent DDL for server-authoritative game runtime tables.
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.CogitaGames', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGames
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(256) NOT NULL,
        StoryboardProjectId UNIQUEIDENTIFIER NULL,
        Mode NVARCHAR(24) NOT NULL,
        SettingsJson NVARCHAR(MAX) NOT NULL,
        IsArchived BIT NOT NULL CONSTRAINT DF_CogitaGames_IsArchived DEFAULT(0),
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGames_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaGames_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_CogitaGames_StoryboardProject FOREIGN KEY (StoryboardProjectId) REFERENCES dbo.CogitaCreationProjects(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGames_Library_Updated' AND object_id = OBJECT_ID('dbo.CogitaGames'))
BEGIN
    CREATE INDEX IX_CogitaGames_Library_Updated ON dbo.CogitaGames(LibraryId, UpdatedUtc);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameValues', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameValues
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GameId UNIQUEIDENTIFIER NOT NULL,
        ValueKey NVARCHAR(96) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        ScopeType NVARCHAR(24) NOT NULL,
        Visibility NVARCHAR(24) NOT NULL,
        DataType NVARCHAR(24) NOT NULL,
        DefaultValueJson NVARCHAR(MAX) NOT NULL,
        ConstraintsJson NVARCHAR(MAX) NULL,
        IsScore BIT NOT NULL CONSTRAINT DF_CogitaGameValues_IsScore DEFAULT(0),
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameValues_Game FOREIGN KEY (GameId) REFERENCES dbo.CogitaGames(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameValues_Game_ValueKey' AND object_id = OBJECT_ID('dbo.CogitaGameValues'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameValues_Game_ValueKey ON dbo.CogitaGameValues(GameId, ValueKey);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameActionGraphs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameActionGraphs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GameId UNIQUEIDENTIFIER NOT NULL,
        Version INT NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        PublishedUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameActionGraphs_Game FOREIGN KEY (GameId) REFERENCES dbo.CogitaGames(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameActionGraphs_Game_Version' AND object_id = OBJECT_ID('dbo.CogitaGameActionGraphs'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameActionGraphs_Game_Version ON dbo.CogitaGameActionGraphs(GameId, Version);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameActionGraphs_Game_Status' AND object_id = OBJECT_ID('dbo.CogitaGameActionGraphs'))
BEGIN
    CREATE INDEX IX_CogitaGameActionGraphs_Game_Status ON dbo.CogitaGameActionGraphs(GameId, Status, Version);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameActionNodes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameActionNodes
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        NodeType NVARCHAR(64) NOT NULL,
        ConfigJson NVARCHAR(MAX) NOT NULL,
        PositionX DECIMAL(9,2) NOT NULL,
        PositionY DECIMAL(9,2) NOT NULL,
        CONSTRAINT FK_CogitaGameActionNodes_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaGameActionGraphs(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameActionNodes_Graph' AND object_id = OBJECT_ID('dbo.CogitaGameActionNodes'))
BEGIN
    CREATE INDEX IX_CogitaGameActionNodes_Graph ON dbo.CogitaGameActionNodes(GraphId);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameActionEdges', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameActionEdges
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        FromNodeId UNIQUEIDENTIFIER NOT NULL,
        FromPort NVARCHAR(64) NULL,
        ToNodeId UNIQUEIDENTIFIER NOT NULL,
        ToPort NVARCHAR(64) NULL,
        CONSTRAINT FK_CogitaGameActionEdges_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaGameActionGraphs(Id),
        CONSTRAINT FK_CogitaGameActionEdges_FromNode FOREIGN KEY (FromNodeId) REFERENCES dbo.CogitaGameActionNodes(Id),
        CONSTRAINT FK_CogitaGameActionEdges_ToNode FOREIGN KEY (ToNodeId) REFERENCES dbo.CogitaGameActionNodes(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameActionEdges_Graph' AND object_id = OBJECT_ID('dbo.CogitaGameActionEdges'))
BEGIN
    CREATE INDEX IX_CogitaGameActionEdges_Graph ON dbo.CogitaGameActionEdges(GraphId);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameLayouts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameLayouts
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GameId UNIQUEIDENTIFIER NOT NULL,
        RoleType NVARCHAR(32) NOT NULL,
        LayoutJson NVARCHAR(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameLayouts_Game FOREIGN KEY (GameId) REFERENCES dbo.CogitaGames(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameLayouts_Game_RoleType' AND object_id = OBJECT_ID('dbo.CogitaGameLayouts'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameLayouts_Game_RoleType ON dbo.CogitaGameLayouts(GameId, RoleType);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameSessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameSessions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        GameId UNIQUEIDENTIFIER NOT NULL,
        HostRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        HostSecretHash VARBINARY(64) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        Phase NVARCHAR(24) NOT NULL,
        RoundIndex INT NOT NULL,
        Version INT NOT NULL,
        SessionMetaJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        StartedUtc DATETIMEOFFSET NULL,
        FinishedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CogitaGameSessions_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaGameSessions_Game FOREIGN KEY (GameId) REFERENCES dbo.CogitaGames(Id),
        CONSTRAINT FK_CogitaGameSessions_HostRole FOREIGN KEY (HostRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameSessions_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaGameSessions'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameSessions_PublicCodeHash ON dbo.CogitaGameSessions(PublicCodeHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameSessions_Library_Created' AND object_id = OBJECT_ID('dbo.CogitaGameSessions'))
BEGIN
    CREATE INDEX IX_CogitaGameSessions_Library_Created ON dbo.CogitaGameSessions(LibraryId, CreatedUtc);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameSessionGroups', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameSessionGroups
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        GroupKey NVARCHAR(96) NOT NULL,
        DisplayName NVARCHAR(160) NOT NULL,
        DisplayNameCipher NVARCHAR(MAX) NULL,
        Capacity INT NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_CogitaGameSessionGroups_IsActive DEFAULT(1),
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameSessionGroups_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameSessionGroups_Session_GroupKey' AND object_id = OBJECT_ID('dbo.CogitaGameSessionGroups'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameSessionGroups_Session_GroupKey ON dbo.CogitaGameSessionGroups(SessionId, GroupKey);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameParticipants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        GroupId UNIQUEIDENTIFIER NULL,
        RoleType NVARCHAR(24) NOT NULL,
        PersonRoleId UNIQUEIDENTIFIER NULL,
        DisplayName NVARCHAR(120) NOT NULL,
        DisplayNameHash VARBINARY(64) NULL,
        DisplayNameCipher NVARCHAR(MAX) NULL,
        ParticipantTokenHash VARBINARY(64) NOT NULL,
        DeviceHash VARBINARY(64) NULL,
        SpoofRiskScore DECIMAL(7,2) NOT NULL CONSTRAINT DF_CogitaGameParticipants_SpoofRisk DEFAULT(0),
        LastLocationMetaJson NVARCHAR(MAX) NULL,
        IsConnected BIT NOT NULL CONSTRAINT DF_CogitaGameParticipants_IsConnected DEFAULT(1),
        JoinedUtc DATETIMEOFFSET NOT NULL,
        LastSeenUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameParticipants_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGameParticipants_Group FOREIGN KEY (GroupId) REFERENCES dbo.CogitaGameSessionGroups(Id) ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameParticipants_Session_TokenHash' AND object_id = OBJECT_ID('dbo.CogitaGameParticipants'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameParticipants_Session_TokenHash ON dbo.CogitaGameParticipants(SessionId, ParticipantTokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameParticipants_Session_DisplayHash' AND object_id = OBJECT_ID('dbo.CogitaGameParticipants'))
BEGIN
    CREATE INDEX IX_CogitaGameParticipants_Session_DisplayHash ON dbo.CogitaGameParticipants(SessionId, DisplayNameHash);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameZones', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameZones
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ZoneKey NVARCHAR(96) NOT NULL,
        SourceType NVARCHAR(24) NOT NULL,
        GeometryJson NVARCHAR(MAX) NOT NULL,
        TriggerRadiusM DECIMAL(9,2) NOT NULL,
        ActiveFromUtc DATETIMEOFFSET NULL,
        ActiveToUtc DATETIMEOFFSET NULL,
        IsEnabled BIT NOT NULL CONSTRAINT DF_CogitaGameZones_IsEnabled DEFAULT(1),
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameZones_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameZones_Session_ZoneKey' AND object_id = OBJECT_ID('dbo.CogitaGameZones'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameZones_Session_ZoneKey ON dbo.CogitaGameZones(SessionId, ZoneKey);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameEventLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameEventLog
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        SeqNo BIGINT NOT NULL,
        EventType NVARCHAR(64) NOT NULL,
        CorrelationId UNIQUEIDENTIFIER NOT NULL,
        CausationId UNIQUEIDENTIFIER NULL,
        ActorParticipantId UNIQUEIDENTIFIER NULL,
        PayloadJson NVARCHAR(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameEventLog_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGameEventLog_ActorParticipant FOREIGN KEY (ActorParticipantId) REFERENCES dbo.CogitaGameParticipants(Id) ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameEventLog_Session_SeqNo' AND object_id = OBJECT_ID('dbo.CogitaGameEventLog'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameEventLog_Session_SeqNo ON dbo.CogitaGameEventLog(SessionId, SeqNo);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameTriggerStates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameTriggerStates
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        TriggerKey NVARCHAR(128) NOT NULL,
        ScopeType NVARCHAR(24) NOT NULL,
        ScopeId UNIQUEIDENTIFIER NULL,
        Status NVARCHAR(24) NOT NULL,
        FiredCount INT NOT NULL,
        CooldownUntilUtc DATETIMEOFFSET NULL,
        LastEvaluatedSeq BIGINT NOT NULL,
        LastFiredUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameTriggerStates_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id)
    );
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameTriggerStates_UniqueScope' AND object_id = OBJECT_ID('dbo.CogitaGameTriggerStates'))
BEGIN
    DROP INDEX UX_CogitaGameTriggerStates_UniqueScope ON dbo.CogitaGameTriggerStates;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameTriggerStates_UniqueScope_NotNull' AND object_id = OBJECT_ID('dbo.CogitaGameTriggerStates'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameTriggerStates_UniqueScope_NotNull
        ON dbo.CogitaGameTriggerStates(SessionId, TriggerKey, ScopeType, ScopeId)
        WHERE ScopeId IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameTriggerStates_UniqueScope_Null' AND object_id = OBJECT_ID('dbo.CogitaGameTriggerStates'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameTriggerStates_UniqueScope_Null
        ON dbo.CogitaGameTriggerStates(SessionId, TriggerKey, ScopeType)
        WHERE ScopeId IS NULL;
END
GO

IF OBJECT_ID(N'dbo.CogitaGameValueLedger', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameValueLedger
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ValueId UNIQUEIDENTIFIER NOT NULL,
        ScopeType NVARCHAR(24) NOT NULL,
        ScopeId UNIQUEIDENTIFIER NULL,
        Delta DECIMAL(18,4) NOT NULL,
        AbsoluteAfter DECIMAL(18,4) NOT NULL,
        ReasonEventId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameValueLedger_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGameValueLedger_Value FOREIGN KEY (ValueId) REFERENCES dbo.CogitaGameValues(Id),
        CONSTRAINT FK_CogitaGameValueLedger_ReasonEvent FOREIGN KEY (ReasonEventId) REFERENCES dbo.CogitaGameEventLog(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameValueLedger_Session_Value_Scope_Created' AND object_id = OBJECT_ID('dbo.CogitaGameValueLedger'))
BEGIN
    CREATE INDEX IX_CogitaGameValueLedger_Session_Value_Scope_Created ON dbo.CogitaGameValueLedger(SessionId, ValueId, ScopeType, ScopeId, CreatedUtc);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameScoreboard', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameScoreboard
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        GroupId UNIQUEIDENTIFIER NULL,
        ParticipantId UNIQUEIDENTIFIER NULL,
        Score DECIMAL(18,4) NOT NULL,
        Rank INT NOT NULL,
        Version INT NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameScoreboard_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGameScoreboard_Group FOREIGN KEY (GroupId) REFERENCES dbo.CogitaGameSessionGroups(Id) ON DELETE SET NULL,
        CONSTRAINT FK_CogitaGameScoreboard_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaGameParticipants(Id) ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGameScoreboard_Session_Group_Participant' AND object_id = OBJECT_ID('dbo.CogitaGameScoreboard'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGameScoreboard_Session_Group_Participant ON dbo.CogitaGameScoreboard(SessionId, GroupId, ParticipantId);
END
GO

IF OBJECT_ID(N'dbo.CogitaGamePresenceStates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGamePresenceStates
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        ZoneId UNIQUEIDENTIFIER NOT NULL,
        PresenceState NVARCHAR(24) NOT NULL,
        EnteredUtc DATETIMEOFFSET NULL,
        ExitedUtc DATETIMEOFFSET NULL,
        LastPingUtc DATETIMEOFFSET NOT NULL,
        Confidence DECIMAL(7,4) NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGamePresenceStates_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGamePresenceStates_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaGameParticipants(Id),
        CONSTRAINT FK_CogitaGamePresenceStates_Zone FOREIGN KEY (ZoneId) REFERENCES dbo.CogitaGameZones(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaGamePresenceStates_Session_Participant_Zone' AND object_id = OBJECT_ID('dbo.CogitaGamePresenceStates'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaGamePresenceStates_Session_Participant_Zone ON dbo.CogitaGamePresenceStates(SessionId, ParticipantId, ZoneId);
END
GO

IF OBJECT_ID(N'dbo.CogitaGameLocationAudit', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaGameLocationAudit
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        GeoHash6 NVARCHAR(12) NOT NULL,
        AccuracyBucket NVARCHAR(24) NOT NULL,
        SpeedBucket NVARCHAR(24) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaGameLocationAudit_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaGameSessions(Id),
        CONSTRAINT FK_CogitaGameLocationAudit_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaGameParticipants(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaGameLocationAudit_Session_Participant_Created' AND object_id = OBJECT_ID('dbo.CogitaGameLocationAudit'))
BEGIN
    CREATE INDEX IX_CogitaGameLocationAudit_Session_Participant_Created ON dbo.CogitaGameLocationAudit(SessionId, ParticipantId, CreatedUtc);
END
GO
