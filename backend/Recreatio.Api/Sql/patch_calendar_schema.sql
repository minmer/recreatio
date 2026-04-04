-- Calendar module schema patch
-- Creates generic, role-scoped calendar storage with share-link read-only support.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'calendar')
BEGIN
    EXEC('CREATE SCHEMA calendar AUTHORIZATION dbo;');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Calendars' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.Calendars
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Slug NVARCHAR(120) NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        OrganizationScope NVARCHAR(128) NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        DefaultTimeZoneId NVARCHAR(64) NULL,
        IsArchived BIT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_Calendars_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_Calendars_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Calendars_Slug' AND object_id = OBJECT_ID('calendar.Calendars'))
BEGIN
    CREATE UNIQUE INDEX UX_Calendars_Slug
        ON calendar.Calendars(Slug)
        WHERE Slug IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Calendars_UpdatedUtc' AND object_id = OBJECT_ID('calendar.Calendars'))
BEGIN
    CREATE INDEX IX_Calendars_UpdatedUtc ON calendar.Calendars(UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Calendars_OrganizationUpdated' AND object_id = OBJECT_ID('calendar.Calendars'))
BEGIN
    CREATE INDEX IX_Calendars_OrganizationUpdated ON calendar.Calendars(OrganizationScope, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarRoleBindings' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarRoleBindings
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        CalendarId UNIQUEIDENTIFIER NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        AccessType NVARCHAR(24) NOT NULL,
        AddedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarRoleBindings_Calendar FOREIGN KEY (CalendarId) REFERENCES calendar.Calendars(Id),
        CONSTRAINT FK_CalendarRoleBindings_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_CalendarRoleBindings_AddedByUser FOREIGN KEY (AddedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarRoleBindings_CalendarRevoked' AND object_id = OBJECT_ID('calendar.CalendarRoleBindings'))
BEGIN
    CREATE INDEX IX_CalendarRoleBindings_CalendarRevoked ON calendar.CalendarRoleBindings(CalendarId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarRoleBindings_RoleRevoked' AND object_id = OBJECT_ID('calendar.CalendarRoleBindings'))
BEGIN
    CREATE INDEX IX_CalendarRoleBindings_RoleRevoked ON calendar.CalendarRoleBindings(RoleId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarRoleBindings_Active' AND object_id = OBJECT_ID('calendar.CalendarRoleBindings'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarRoleBindings_Active
        ON calendar.CalendarRoleBindings(CalendarId, RoleId)
        WHERE RevokedUtc IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEvents' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        CalendarId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        TitlePublic NVARCHAR(200) NOT NULL,
        SummaryPublic NVARCHAR(2000) NULL,
        LocationPublic NVARCHAR(320) NULL,
        Visibility NVARCHAR(24) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        StartUtc DATETIMEOFFSET NOT NULL,
        EndUtc DATETIMEOFFSET NOT NULL,
        AllDay BIT NOT NULL,
        TimeZoneId NVARCHAR(64) NULL,
        RecurrenceType NVARCHAR(24) NOT NULL,
        RecurrenceInterval INT NOT NULL,
        RecurrenceByWeekday NVARCHAR(32) NULL,
        RecurrenceUntilUtc DATETIMEOFFSET NULL,
        RecurrenceCount INT NULL,
        RecurrenceRule NVARCHAR(512) NULL,
        ProtectedDataItemId UNIQUEIDENTIFIER NULL,
        LinkedModule NVARCHAR(64) NULL,
        LinkedEntityType NVARCHAR(64) NULL,
        LinkedEntityId UNIQUEIDENTIFIER NULL,
        SourceFieldStart NVARCHAR(64) NULL,
        SourceFieldEnd NVARCHAR(64) NULL,
        ConflictScopeMode NVARCHAR(24) NOT NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        UpdatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CancelledUtc DATETIMEOFFSET NULL,
        IsArchived BIT NOT NULL,
        CONSTRAINT FK_CalendarEvents_Calendar FOREIGN KEY (CalendarId) REFERENCES calendar.Calendars(Id),
        CONSTRAINT FK_CalendarEvents_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_CalendarEvents_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT FK_CalendarEvents_UpdatedByUser FOREIGN KEY (UpdatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT FK_CalendarEvents_ProtectedDataItem FOREIGN KEY (ProtectedDataItemId) REFERENCES dbo.DataItems(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_CalendarStart' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_CalendarStart ON calendar.CalendarEvents(CalendarId, StartUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_CalendarStatusStart' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_CalendarStatusStart ON calendar.CalendarEvents(CalendarId, Status, StartUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_CalendarLinkedEntity' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_CalendarLinkedEntity ON calendar.CalendarEvents(CalendarId, LinkedModule, LinkedEntityType, LinkedEntityId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventRoleScopes' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventRoleScopes
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        RoleId UNIQUEIDENTIFIER NOT NULL,
        ScopeType NVARCHAR(24) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarEventRoleScopes_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarEventRoleScopes_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventRoleScopes_EventRevoked' AND object_id = OBJECT_ID('calendar.CalendarEventRoleScopes'))
BEGIN
    CREATE INDEX IX_CalendarEventRoleScopes_EventRevoked ON calendar.CalendarEventRoleScopes(EventId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventRoleScopes_RoleRevoked' AND object_id = OBJECT_ID('calendar.CalendarEventRoleScopes'))
BEGIN
    CREATE INDEX IX_CalendarEventRoleScopes_RoleRevoked ON calendar.CalendarEventRoleScopes(RoleId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarEventRoleScopes_Active' AND object_id = OBJECT_ID('calendar.CalendarEventRoleScopes'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarEventRoleScopes_Active
        ON calendar.CalendarEventRoleScopes(EventId, RoleId)
        WHERE RevokedUtc IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventReminders' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventReminders
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        MinutesBefore INT NOT NULL,
        Channel NVARCHAR(24) NOT NULL,
        TargetRoleId UNIQUEIDENTIFIER NULL,
        TargetUserId UNIQUEIDENTIFIER NULL,
        Status NVARCHAR(24) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CalendarEventReminders_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarEventReminders_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_CalendarEventReminders_TargetUser FOREIGN KEY (TargetUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventReminders_EventStatus' AND object_id = OBJECT_ID('calendar.CalendarEventReminders'))
BEGIN
    CREATE INDEX IX_CalendarEventReminders_EventStatus ON calendar.CalendarEventReminders(EventId, Status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventShareLinks' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventShareLinks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        CodeHash VARBINARY(32) NOT NULL,
        Label NVARCHAR(120) NOT NULL,
        Mode NVARCHAR(24) NOT NULL,
        IsActive BIT NOT NULL,
        ExpiresUtc DATETIMEOFFSET NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        LastUsedUtc DATETIMEOFFSET NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarEventShareLinks_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarEventShareLinks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT UX_CalendarEventShareLinks_CodeHash UNIQUE (CodeHash)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventShareLinks_EventActive' AND object_id = OBJECT_ID('calendar.CalendarEventShareLinks'))
BEGIN
    CREATE INDEX IX_CalendarEventShareLinks_EventActive ON calendar.CalendarEventShareLinks(EventId, IsActive, RevokedUtc, ExpiresUtc);
END
GO
