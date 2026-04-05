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

-- Calendar core v1 extensions: tasks + graph scheduling + shared views + reminder dispatch
IF COL_LENGTH('calendar.CalendarEvents', 'ItemType') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD ItemType NVARCHAR(24) NOT NULL CONSTRAINT DF_CalendarEvents_ItemType DEFAULT 'appointment';
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'TaskState') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD TaskState NVARCHAR(24) NULL;
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'CompletedUtc') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD CompletedUtc DATETIMEOFFSET NULL;
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'TaskProgressPercent') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD TaskProgressPercent INT NULL;
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'RequiresCompletionProof') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD RequiresCompletionProof BIT NOT NULL CONSTRAINT DF_CalendarEvents_RequiresCompletionProof DEFAULT 0;
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'CompletionProofDataItemId') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD CompletionProofDataItemId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'AssigneeRoleId') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD AssigneeRoleId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('calendar.CalendarEventReminders', 'ChannelConfigJson') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEventReminders ADD ChannelConfigJson NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_CalendarItemStart' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_CalendarItemStart ON calendar.CalendarEvents(CalendarId, ItemType, StartUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_CalendarTaskStateStart' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_CalendarTaskStateStart ON calendar.CalendarEvents(CalendarId, ItemType, TaskState, StartUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventReminders_ChannelStatusUpdated' AND object_id = OBJECT_ID('calendar.CalendarEventReminders'))
BEGIN
    CREATE INDEX IX_CalendarEventReminders_ChannelStatusUpdated ON calendar.CalendarEventReminders(Channel, Status, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarScheduleGraphs' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarScheduleGraphs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        TemplateKey NVARCHAR(64) NOT NULL,
        TemplateConfigJson NVARCHAR(MAX) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        Version INT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CalendarScheduleGraphs_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarScheduleGraphs_EventStatus' AND object_id = OBJECT_ID('calendar.CalendarScheduleGraphs'))
BEGIN
    CREATE INDEX IX_CalendarScheduleGraphs_EventStatus ON calendar.CalendarScheduleGraphs(EventId, Status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarScheduleGraphs_EventVersion' AND object_id = OBJECT_ID('calendar.CalendarScheduleGraphs'))
BEGIN
    CREATE INDEX IX_CalendarScheduleGraphs_EventVersion ON calendar.CalendarScheduleGraphs(EventId, Version);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarScheduleGraphNodes' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarScheduleGraphNodes
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        NodeType NVARCHAR(64) NOT NULL,
        NodeKey NVARCHAR(128) NOT NULL,
        ConfigJson NVARCHAR(MAX) NOT NULL,
        PositionX DECIMAL(9,2) NOT NULL,
        PositionY DECIMAL(9,2) NOT NULL,
        CONSTRAINT FK_CalendarScheduleGraphNodes_Graph FOREIGN KEY (GraphId) REFERENCES calendar.CalendarScheduleGraphs(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarScheduleGraphNodes_GraphNodeKey' AND object_id = OBJECT_ID('calendar.CalendarScheduleGraphNodes'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarScheduleGraphNodes_GraphNodeKey ON calendar.CalendarScheduleGraphNodes(GraphId, NodeKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarScheduleGraphEdges' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarScheduleGraphEdges
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        FromNodeId UNIQUEIDENTIFIER NOT NULL,
        FromPort NVARCHAR(64) NULL,
        ToNodeId UNIQUEIDENTIFIER NOT NULL,
        ToPort NVARCHAR(64) NULL,
        EdgeType NVARCHAR(64) NULL,
        ConditionJson NVARCHAR(MAX) NULL,
        CONSTRAINT FK_CalendarScheduleGraphEdges_Graph FOREIGN KEY (GraphId) REFERENCES calendar.CalendarScheduleGraphs(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarScheduleGraphEdges_Graph' AND object_id = OBJECT_ID('calendar.CalendarScheduleGraphEdges'))
BEGIN
    CREATE INDEX IX_CalendarScheduleGraphEdges_Graph ON calendar.CalendarScheduleGraphEdges(GraphId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarScheduleGraphEdges_GraphNodes' AND object_id = OBJECT_ID('calendar.CalendarScheduleGraphEdges'))
BEGIN
    CREATE INDEX IX_CalendarScheduleGraphEdges_GraphNodes ON calendar.CalendarScheduleGraphEdges(GraphId, FromNodeId, ToNodeId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarGraphExecutions' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarGraphExecutions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        EventId UNIQUEIDENTIFIER NOT NULL,
        IdempotencyKey NVARCHAR(128) NOT NULL,
        TriggerType NVARCHAR(32) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        TriggerPayloadJson NVARCHAR(MAX) NULL,
        ResultPayloadJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        StartedUtc DATETIMEOFFSET NOT NULL,
        FinishedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarGraphExecutions_Graph FOREIGN KEY (GraphId) REFERENCES calendar.CalendarScheduleGraphs(Id),
        CONSTRAINT FK_CalendarGraphExecutions_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarGraphExecutions_GraphCreated' AND object_id = OBJECT_ID('calendar.CalendarGraphExecutions'))
BEGIN
    CREATE INDEX IX_CalendarGraphExecutions_GraphCreated ON calendar.CalendarGraphExecutions(GraphId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarGraphExecutions_GraphIdempotency' AND object_id = OBJECT_ID('calendar.CalendarGraphExecutions'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarGraphExecutions_GraphIdempotency ON calendar.CalendarGraphExecutions(GraphId, IdempotencyKey);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarSharedViewLinks' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarSharedViewLinks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        SharedViewId UNIQUEIDENTIFIER NOT NULL,
        Label NVARCHAR(120) NOT NULL,
        Mode NVARCHAR(24) NOT NULL,
        IsActive BIT NOT NULL,
        ExpiresUtc DATETIMEOFFSET NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        LastUsedUtc DATETIMEOFFSET NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarSharedViewLinks_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarSharedViewLinks_SharedView FOREIGN KEY (SharedViewId) REFERENCES dbo.SharedViews(Id),
        CONSTRAINT FK_CalendarSharedViewLinks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarSharedViewLinks_EventActive' AND object_id = OBJECT_ID('calendar.CalendarSharedViewLinks'))
BEGIN
    CREATE INDEX IX_CalendarSharedViewLinks_EventActive ON calendar.CalendarSharedViewLinks(EventId, IsActive, RevokedUtc, ExpiresUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarSharedViewLinks_SharedViewId' AND object_id = OBJECT_ID('calendar.CalendarSharedViewLinks'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarSharedViewLinks_SharedViewId ON calendar.CalendarSharedViewLinks(SharedViewId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarReminderDispatches' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarReminderDispatches
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        ReminderId UNIQUEIDENTIFIER NOT NULL,
        OccurrenceStartUtc DATETIMEOFFSET NOT NULL,
        IdempotencyKey NVARCHAR(128) NOT NULL,
        Channel NVARCHAR(24) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        AttemptCount INT NOT NULL,
        NextRetryUtc DATETIMEOFFSET NULL,
        LastAttemptUtc DATETIMEOFFSET NULL,
        DeliveredUtc DATETIMEOFFSET NULL,
        LastError NVARCHAR(2048) NULL,
        DeliveryPayloadJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CalendarReminderDispatches_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarReminderDispatches_Reminder FOREIGN KEY (ReminderId) REFERENCES calendar.CalendarEventReminders(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarReminderDispatches_ReminderOccurrence' AND object_id = OBJECT_ID('calendar.CalendarReminderDispatches'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarReminderDispatches_ReminderOccurrence ON calendar.CalendarReminderDispatches(ReminderId, OccurrenceStartUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarReminderDispatches_StatusRetry' AND object_id = OBJECT_ID('calendar.CalendarReminderDispatches'))
BEGIN
    CREATE INDEX IX_CalendarReminderDispatches_StatusRetry ON calendar.CalendarReminderDispatches(Status, NextRetryUtc, UpdatedUtc);
END
GO

-- Calendar core v1.1 extensions: viewer policy + reusable graphs + event groups
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventGroups' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventGroups
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        CalendarId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        Category NVARCHAR(64) NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        IsArchived BIT NOT NULL,
        CONSTRAINT FK_CalendarEventGroups_Calendar FOREIGN KEY (CalendarId) REFERENCES calendar.Calendars(Id),
        CONSTRAINT FK_CalendarEventGroups_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT FK_CalendarEventGroups_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventGroups_CalendarUpdated' AND object_id = OBJECT_ID('calendar.CalendarEventGroups'))
BEGIN
    CREATE INDEX IX_CalendarEventGroups_CalendarUpdated ON calendar.CalendarEventGroups(CalendarId, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventGroups_CalendarArchivedUpdated' AND object_id = OBJECT_ID('calendar.CalendarEventGroups'))
BEGIN
    CREATE INDEX IX_CalendarEventGroups_CalendarArchivedUpdated ON calendar.CalendarEventGroups(CalendarId, IsArchived, UpdatedUtc);
END
GO

IF COL_LENGTH('calendar.CalendarEvents', 'EventGroupId') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEvents ADD EventGroupId UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_CalendarEvents_EventGroup'
      AND parent_object_id = OBJECT_ID('calendar.CalendarEvents')
)
BEGIN
    ALTER TABLE calendar.CalendarEvents
    ADD CONSTRAINT FK_CalendarEvents_EventGroup FOREIGN KEY (EventGroupId) REFERENCES calendar.CalendarEventGroups(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEvents_EventGroupStart' AND object_id = OBJECT_ID('calendar.CalendarEvents'))
BEGIN
    CREATE INDEX IX_CalendarEvents_EventGroupStart ON calendar.CalendarEvents(EventGroupId, StartUtc);
END
GO

IF COL_LENGTH('calendar.CalendarEventRoleScopes', 'ViewerCanSeeTitle') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEventRoleScopes ADD ViewerCanSeeTitle BIT NOT NULL CONSTRAINT DF_CalendarEventRoleScopes_ViewerCanSeeTitle DEFAULT 1;
END
GO

IF COL_LENGTH('calendar.CalendarEventRoleScopes', 'ViewerCanSeeGraph') IS NULL
BEGIN
    ALTER TABLE calendar.CalendarEventRoleScopes ADD ViewerCanSeeGraph BIT NOT NULL CONSTRAINT DF_CalendarEventRoleScopes_ViewerCanSeeGraph DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventGraphLinks' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventGraphLinks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        IsPrimary BIT NOT NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarEventGraphLinks_Event FOREIGN KEY (EventId) REFERENCES calendar.CalendarEvents(Id),
        CONSTRAINT FK_CalendarEventGraphLinks_Graph FOREIGN KEY (GraphId) REFERENCES calendar.CalendarScheduleGraphs(Id),
        CONSTRAINT FK_CalendarEventGraphLinks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventGraphLinks_EventRevoked' AND object_id = OBJECT_ID('calendar.CalendarEventGraphLinks'))
BEGIN
    CREATE INDEX IX_CalendarEventGraphLinks_EventRevoked ON calendar.CalendarEventGraphLinks(EventId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventGraphLinks_GraphRevoked' AND object_id = OBJECT_ID('calendar.CalendarEventGraphLinks'))
BEGIN
    CREATE INDEX IX_CalendarEventGraphLinks_GraphRevoked ON calendar.CalendarEventGraphLinks(GraphId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarEventGraphLinks_Active' AND object_id = OBJECT_ID('calendar.CalendarEventGraphLinks'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarEventGraphLinks_Active
        ON calendar.CalendarEventGraphLinks(EventId, GraphId)
        WHERE RevokedUtc IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CalendarEventGroupShareLinks' AND schema_id = SCHEMA_ID('calendar'))
BEGIN
    CREATE TABLE calendar.CalendarEventGroupShareLinks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventGroupId UNIQUEIDENTIFIER NOT NULL,
        SharedViewId UNIQUEIDENTIFIER NOT NULL,
        Label NVARCHAR(120) NOT NULL,
        Mode NVARCHAR(24) NOT NULL,
        IsActive BIT NOT NULL,
        ExpiresUtc DATETIMEOFFSET NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        LastUsedUtc DATETIMEOFFSET NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CalendarEventGroupShareLinks_Group FOREIGN KEY (EventGroupId) REFERENCES calendar.CalendarEventGroups(Id),
        CONSTRAINT FK_CalendarEventGroupShareLinks_SharedView FOREIGN KEY (SharedViewId) REFERENCES dbo.SharedViews(Id),
        CONSTRAINT FK_CalendarEventGroupShareLinks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CalendarEventGroupShareLinks_GroupActive' AND object_id = OBJECT_ID('calendar.CalendarEventGroupShareLinks'))
BEGIN
    CREATE INDEX IX_CalendarEventGroupShareLinks_GroupActive ON calendar.CalendarEventGroupShareLinks(EventGroupId, IsActive, RevokedUtc, ExpiresUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CalendarEventGroupShareLinks_SharedViewId' AND object_id = OBJECT_ID('calendar.CalendarEventGroupShareLinks'))
BEGIN
    CREATE UNIQUE INDEX UX_CalendarEventGroupShareLinks_SharedViewId ON calendar.CalendarEventGroupShareLinks(SharedViewId);
END
GO
