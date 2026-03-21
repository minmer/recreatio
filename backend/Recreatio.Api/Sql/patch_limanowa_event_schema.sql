-- Limanowa dedicated event schema patch
-- Safe to run multiple times (idempotent).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'limanowa')
BEGIN
    EXEC('CREATE SCHEMA limanowa AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'limanowa.LimanowaEvents', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Slug NVARCHAR(80) NOT NULL,
        Title NVARCHAR(220) NOT NULL,
        Subtitle NVARCHAR(520) NOT NULL,
        Tagline NVARCHAR(260) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        CapacityTotal INT NOT NULL,
        RegistrationOpen BIT NOT NULL,
        RegistrationGroupsDeadline DATE NOT NULL,
        RegistrationParticipantsDeadline DATE NOT NULL,
        Published BIT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_LimanowaEvents_Slug' AND object_id = OBJECT_ID('limanowa.LimanowaEvents'))
BEGIN
    CREATE UNIQUE INDEX UX_LimanowaEvents_Slug ON limanowa.LimanowaEvents(Slug);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaGroups', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaGroups
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ParishName NVARCHAR(220) NOT NULL,
        ResponsibleName NVARCHAR(200) NOT NULL,
        Phone NVARCHAR(32) NOT NULL,
        Email NVARCHAR(180) NOT NULL,
        ExpectedParticipantCount INT NOT NULL,
        ExpectedGuardianCount INT NOT NULL,
        Notes NVARCHAR(2400) NULL,
        Status NVARCHAR(64) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaGroups_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaGroups_EventCreated' AND object_id = OBJECT_ID('limanowa.LimanowaGroups'))
BEGIN
    CREATE INDEX IX_LimanowaGroups_EventCreated ON limanowa.LimanowaGroups(EventId, CreatedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaGroupAdminAccesses', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaGroupAdminAccesses
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        GroupId UNIQUEIDENTIFIER NOT NULL,
        TokenHash VARBINARY(32) NOT NULL,
        Phone NVARCHAR(32) NOT NULL,
        SentAt DATETIMEOFFSET NULL,
        LastOpenedAt DATETIMEOFFSET NULL,
        Active BIT NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaGroupAdminAccesses_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id),
        CONSTRAINT FK_LimanowaGroupAdminAccesses_Group FOREIGN KEY (GroupId) REFERENCES limanowa.LimanowaGroups(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_LimanowaGroupAdminAccesses_TokenHash' AND object_id = OBJECT_ID('limanowa.LimanowaGroupAdminAccesses'))
BEGIN
    CREATE UNIQUE INDEX UX_LimanowaGroupAdminAccesses_TokenHash ON limanowa.LimanowaGroupAdminAccesses(TokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaGroupAdminAccesses_EventGroupActive' AND object_id = OBJECT_ID('limanowa.LimanowaGroupAdminAccesses'))
BEGIN
    CREATE INDEX IX_LimanowaGroupAdminAccesses_EventGroupActive ON limanowa.LimanowaGroupAdminAccesses(EventId, GroupId, Active);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaParticipants', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        GroupId UNIQUEIDENTIFIER NOT NULL,
        FullName NVARCHAR(200) NOT NULL,
        Phone NVARCHAR(32) NOT NULL,
        ParishName NVARCHAR(220) NOT NULL,
        ParentContactName NVARCHAR(200) NULL,
        ParentContactPhone NVARCHAR(32) NULL,
        GuardianName NVARCHAR(200) NULL,
        GuardianPhone NVARCHAR(32) NULL,
        Notes NVARCHAR(2400) NULL,
        HealthNotes NVARCHAR(2400) NULL,
        AccommodationType NVARCHAR(64) NULL,
        Status NVARCHAR(64) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaParticipants_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id),
        CONSTRAINT FK_LimanowaParticipants_Group FOREIGN KEY (GroupId) REFERENCES limanowa.LimanowaGroups(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaParticipants_EventGroupCreated' AND object_id = OBJECT_ID('limanowa.LimanowaParticipants'))
BEGIN
    CREATE INDEX IX_LimanowaParticipants_EventGroupCreated ON limanowa.LimanowaParticipants(EventId, GroupId, CreatedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaParticipantAccesses', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaParticipantAccesses
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        TokenHash VARBINARY(32) NOT NULL,
        Phone NVARCHAR(32) NOT NULL,
        SentAt DATETIMEOFFSET NULL,
        LastOpenedAt DATETIMEOFFSET NULL,
        Active BIT NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaParticipantAccesses_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id),
        CONSTRAINT FK_LimanowaParticipantAccesses_Participant FOREIGN KEY (ParticipantId) REFERENCES limanowa.LimanowaParticipants(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_LimanowaParticipantAccesses_TokenHash' AND object_id = OBJECT_ID('limanowa.LimanowaParticipantAccesses'))
BEGIN
    CREATE UNIQUE INDEX UX_LimanowaParticipantAccesses_TokenHash ON limanowa.LimanowaParticipantAccesses(TokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaParticipantAccesses_EventParticipantActive' AND object_id = OBJECT_ID('limanowa.LimanowaParticipantAccesses'))
BEGIN
    CREATE INDEX IX_LimanowaParticipantAccesses_EventParticipantActive ON limanowa.LimanowaParticipantAccesses(EventId, ParticipantId, Active);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaQuestionThreads', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaQuestionThreads
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        RelatedType NVARCHAR(32) NOT NULL,
        RelatedId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaQuestionThreads_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaQuestionThreads_EventRelatedCreated' AND object_id = OBJECT_ID('limanowa.LimanowaQuestionThreads'))
BEGIN
    CREATE INDEX IX_LimanowaQuestionThreads_EventRelatedCreated ON limanowa.LimanowaQuestionThreads(EventId, RelatedType, RelatedId, CreatedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaQuestionMessages', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaQuestionMessages
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ThreadId UNIQUEIDENTIFIER NOT NULL,
        AuthorType NVARCHAR(32) NOT NULL,
        Message NVARCHAR(2400) NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaQuestionMessages_Thread FOREIGN KEY (ThreadId) REFERENCES limanowa.LimanowaQuestionThreads(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaQuestionMessages_ThreadCreated' AND object_id = OBJECT_ID('limanowa.LimanowaQuestionMessages'))
BEGIN
    CREATE INDEX IX_LimanowaQuestionMessages_ThreadCreated ON limanowa.LimanowaQuestionMessages(ThreadId, CreatedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaAnnouncements', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaAnnouncements
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(220) NOT NULL,
        Body NVARCHAR(3200) NOT NULL,
        AudienceType NVARCHAR(32) NOT NULL,
        PublishedAt DATETIMEOFFSET NOT NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaAnnouncements_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaAnnouncements_EventPublished' AND object_id = OBJECT_ID('limanowa.LimanowaAnnouncements'))
BEGIN
    CREATE INDEX IX_LimanowaAnnouncements_EventPublished ON limanowa.LimanowaAnnouncements(EventId, PublishedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaAccommodationAssignments', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaAccommodationAssignments
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        Type NVARCHAR(64) NOT NULL,
        Note NVARCHAR(1200) NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_LimanowaAccommodationAssignments_Participant UNIQUE (ParticipantId),
        CONSTRAINT FK_LimanowaAccommodationAssignments_Participant FOREIGN KEY (ParticipantId) REFERENCES limanowa.LimanowaParticipants(Id)
    );
END
GO

IF OBJECT_ID(N'limanowa.LimanowaRegistrationStatusLogs', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaRegistrationStatusLogs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        RelatedType NVARCHAR(32) NOT NULL,
        RelatedId UNIQUEIDENTIFIER NOT NULL,
        PreviousStatus NVARCHAR(64) NULL,
        NewStatus NVARCHAR(64) NOT NULL,
        ChangedByType NVARCHAR(32) NOT NULL,
        ChangedById UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_LimanowaRegistrationStatusLogs_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_LimanowaStatusLogs_EventRelatedCreated' AND object_id = OBJECT_ID('limanowa.LimanowaRegistrationStatusLogs'))
BEGIN
    CREATE INDEX IX_LimanowaStatusLogs_EventRelatedCreated ON limanowa.LimanowaRegistrationStatusLogs(EventId, RelatedType, RelatedId, CreatedAt);
END
GO

IF OBJECT_ID(N'limanowa.LimanowaConsentRecords', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaConsentRecords
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        RulesAccepted BIT NOT NULL,
        PrivacyAccepted BIT NOT NULL,
        SubmittedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_LimanowaConsentRecords_Participant UNIQUE (ParticipantId),
        CONSTRAINT FK_LimanowaConsentRecords_Participant FOREIGN KEY (ParticipantId) REFERENCES limanowa.LimanowaParticipants(Id)
    );
END
GO

IF OBJECT_ID(N'limanowa.LimanowaPolicyLinkConfigs', N'U') IS NULL
BEGIN
    CREATE TABLE limanowa.LimanowaPolicyLinkConfigs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        PrivacyPolicyUrl NVARCHAR(520) NOT NULL,
        EventRulesUrl NVARCHAR(520) NOT NULL,
        ThingsToBringUrl NVARCHAR(520) NOT NULL,
        UpdatedAt DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_LimanowaPolicyLinkConfigs_Event UNIQUE (EventId),
        CONSTRAINT FK_LimanowaPolicyLinkConfigs_Event FOREIGN KEY (EventId) REFERENCES limanowa.LimanowaEvents(Id)
    );
END
GO
