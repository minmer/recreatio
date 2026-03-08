-- Pilgrimage event module
-- Adds dedicated event tables in separate [pilgrimage] schema.
-- Existing tables are not modified.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'pilgrimage')
BEGIN
    EXEC('CREATE SCHEMA pilgrimage AUTHORIZATION dbo;');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageEvents' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Slug NVARCHAR(80) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Motto NVARCHAR(180) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        StartLocation NVARCHAR(160) NOT NULL,
        EndLocation NVARCHAR(160) NOT NULL,
        Theme NVARCHAR(32) NOT NULL,
        DistanceKm DECIMAL(7, 2) NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        OrganizerRoleId UNIQUEIDENTIFIER NOT NULL,
        LogisticsRoleId UNIQUEIDENTIFIER NOT NULL,
        MedicalRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicRoleId UNIQUEIDENTIFIER NOT NULL,
        ParticipantDataItemId UNIQUEIDENTIFIER NOT NULL,
        ParticipantDataKeyId UNIQUEIDENTIFIER NOT NULL,
        EmergencyDataItemId UNIQUEIDENTIFIER NOT NULL,
        EmergencyDataKeyId UNIQUEIDENTIFIER NOT NULL,
        ParticipantDataKeyServerEnc VARBINARY(MAX) NOT NULL,
        EmergencyDataKeyServerEnc VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_PilgrimageEvents_Slug UNIQUE (Slug),
        CONSTRAINT FK_PilgrimageEvents_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_PilgrimageEvents_OrganizerRole FOREIGN KEY (OrganizerRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_PilgrimageEvents_LogisticsRole FOREIGN KEY (LogisticsRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_PilgrimageEvents_MedicalRole FOREIGN KEY (MedicalRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_PilgrimageEvents_PublicRole FOREIGN KEY (PublicRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageSiteConfigs' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageSiteConfigs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        PublicConfigJson NVARCHAR(MAX) NOT NULL,
        ParticipantConfigJson NVARCHAR(MAX) NOT NULL,
        OrganizerConfigJson NVARCHAR(MAX) NOT NULL,
        IsPublished BIT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_PilgrimageSiteConfigs_Event UNIQUE (EventId),
        CONSTRAINT FK_PilgrimageSiteConfigs_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageParticipants' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ParticipationVariant NVARCHAR(32) NOT NULL,
        GroupName NVARCHAR(120) NULL,
        RegistrationStatus NVARCHAR(32) NOT NULL,
        PaymentStatus NVARCHAR(32) NOT NULL,
        AttendanceStatus NVARCHAR(32) NOT NULL,
        NeedsLodging BIT NOT NULL,
        NeedsBaggageTransport BIT NOT NULL,
        IsMinor BIT NOT NULL,
        AcceptedTerms BIT NOT NULL,
        AcceptedRodo BIT NOT NULL,
        IdentityDigest VARBINARY(32) NOT NULL,
        PayloadEnc VARBINARY(MAX) NOT NULL,
        PayloadDataKeyId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageParticipants_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id)
    );
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'GroupName') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD GroupName NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'AttendanceStatus') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD AttendanceStatus NVARCHAR(32) NOT NULL CONSTRAINT DF_PilgrimageParticipants_AttendanceStatus DEFAULT 'not-checked-in';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageParticipants_EventCreated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageParticipants'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipants_EventCreated ON pilgrimage.PilgrimageParticipants(EventId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageParticipantAccessTokens' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageParticipantAccessTokens
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        TokenHash VARBINARY(32) NOT NULL,
        ExpiresUtc DATETIMEOFFSET NOT NULL,
        LastUsedUtc DATETIMEOFFSET NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageParticipantAccessTokens_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id),
        CONSTRAINT FK_PilgrimageParticipantAccessTokens_Participant FOREIGN KEY (ParticipantId) REFERENCES pilgrimage.PilgrimageParticipants(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PilgrimageParticipantAccessTokens_TokenHash' AND object_id = OBJECT_ID('pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    CREATE UNIQUE INDEX UX_PilgrimageParticipantAccessTokens_TokenHash
        ON pilgrimage.PilgrimageParticipantAccessTokens(TokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageParticipantAccessTokens_EventParticipant' AND object_id = OBJECT_ID('pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipantAccessTokens_EventParticipant
        ON pilgrimage.PilgrimageParticipantAccessTokens(EventId, ParticipantId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageAnnouncements' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageAnnouncements
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        Audience NVARCHAR(24) NOT NULL,
        Title NVARCHAR(180) NOT NULL,
        Body NVARCHAR(2400) NOT NULL,
        IsCritical BIT NOT NULL,
        CreatedByRoleId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageAnnouncements_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id),
        CONSTRAINT FK_PilgrimageAnnouncements_CreatedByRole FOREIGN KEY (CreatedByRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageAnnouncements_EventCreated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageAnnouncements'))
BEGIN
    CREATE INDEX IX_PilgrimageAnnouncements_EventCreated ON pilgrimage.PilgrimageAnnouncements(EventId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageTasks' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageTasks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        Title NVARCHAR(180) NOT NULL,
        Description NVARCHAR(2400) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        Priority NVARCHAR(24) NOT NULL,
        Assignee NVARCHAR(160) NOT NULL,
        Comments NVARCHAR(4000) NULL,
        Attachments NVARCHAR(2000) NULL,
        DueUtc DATETIMEOFFSET NULL,
        CreatedByRoleId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageTasks_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id),
        CONSTRAINT FK_PilgrimageTasks_CreatedByRole FOREIGN KEY (CreatedByRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageTasks', 'Comments') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageTasks ADD Comments NVARCHAR(4000) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageTasks', 'Attachments') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageTasks ADD Attachments NVARCHAR(2000) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageTasks_EventStatusUpdated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageTasks'))
BEGIN
    CREATE INDEX IX_PilgrimageTasks_EventStatusUpdated ON pilgrimage.PilgrimageTasks(EventId, Status, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageParticipantIssues' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageParticipantIssues
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        Kind NVARCHAR(32) NOT NULL,
        Message NVARCHAR(2400) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        ResolutionNote NVARCHAR(1200) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageParticipantIssues_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id),
        CONSTRAINT FK_PilgrimageParticipantIssues_Participant FOREIGN KEY (ParticipantId) REFERENCES pilgrimage.PilgrimageParticipants(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageParticipantIssues_EventStatusUpdated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageParticipantIssues'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipantIssues_EventStatusUpdated ON pilgrimage.PilgrimageParticipantIssues(EventId, Status, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageParticipantIssues_EventParticipantCreated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageParticipantIssues'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipantIssues_EventParticipantCreated ON pilgrimage.PilgrimageParticipantIssues(EventId, ParticipantId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PilgrimageContactInquiries' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PilgrimageContactInquiries
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(180) NOT NULL,
        Phone NVARCHAR(80) NULL,
        Email NVARCHAR(180) NULL,
        Topic NVARCHAR(120) NOT NULL,
        Message NVARCHAR(2400) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageContactInquiries_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageContactInquiries_EventStatusUpdated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageContactInquiries'))
BEGIN
    CREATE INDEX IX_PilgrimageContactInquiries_EventStatusUpdated ON pilgrimage.PilgrimageContactInquiries(EventId, Status, UpdatedUtc);
END
GO
