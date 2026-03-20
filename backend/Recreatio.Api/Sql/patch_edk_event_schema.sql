-- EDK dedicated schema patch
-- Purpose: introduce independent EDK storage, separate from pilgrimage tables.
-- Safe to run multiple times (idempotent).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'edk')
BEGIN
    EXEC('CREATE SCHEMA edk AUTHORIZATION dbo;');
END
GO

IF OBJECT_ID(N'edk.EdkEvents', N'U') IS NULL
BEGIN
    CREATE TABLE edk.EdkEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Slug NVARCHAR(80) NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Motto NVARCHAR(220) NOT NULL,
        StartDate DATE NOT NULL,
        EndDate DATE NOT NULL,
        StartLocation NVARCHAR(160) NOT NULL,
        EndLocation NVARCHAR(160) NOT NULL,
        OrganizerName NVARCHAR(160) NOT NULL,
        OrganizerEmail NVARCHAR(180) NOT NULL,
        OrganizerPhone NVARCHAR(32) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL
    );
END
GO

IF COL_LENGTH('edk.EdkEvents', 'Slug') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD Slug NVARCHAR(80) NOT NULL CONSTRAINT DF_EdkEvents_Slug DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'Name') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD Name NVARCHAR(200) NOT NULL CONSTRAINT DF_EdkEvents_Name DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'Motto') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD Motto NVARCHAR(220) NOT NULL CONSTRAINT DF_EdkEvents_Motto DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'StartDate') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD StartDate DATE NOT NULL CONSTRAINT DF_EdkEvents_StartDate DEFAULT('2000-01-01');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'EndDate') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD EndDate DATE NOT NULL CONSTRAINT DF_EdkEvents_EndDate DEFAULT('2000-01-01');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'StartLocation') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD StartLocation NVARCHAR(160) NOT NULL CONSTRAINT DF_EdkEvents_StartLocation DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'EndLocation') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD EndLocation NVARCHAR(160) NOT NULL CONSTRAINT DF_EdkEvents_EndLocation DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'OrganizerName') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD OrganizerName NVARCHAR(160) NOT NULL CONSTRAINT DF_EdkEvents_OrganizerName DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'OrganizerEmail') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD OrganizerEmail NVARCHAR(180) NOT NULL CONSTRAINT DF_EdkEvents_OrganizerEmail DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'OrganizerPhone') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD OrganizerPhone NVARCHAR(32) NOT NULL CONSTRAINT DF_EdkEvents_OrganizerPhone DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkEvents', 'CreatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkEvents_CreatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF COL_LENGTH('edk.EdkEvents', 'UpdatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkEvents ADD UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkEvents_UpdatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EdkEvents_Slug' AND object_id = OBJECT_ID('edk.EdkEvents'))
BEGIN
    CREATE UNIQUE INDEX UX_EdkEvents_Slug ON edk.EdkEvents(Slug);
END
GO

IF OBJECT_ID(N'edk.EdkSiteConfigs', N'U') IS NULL
BEGIN
    CREATE TABLE edk.EdkSiteConfigs
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        SiteConfigJson NVARCHAR(MAX) NOT NULL,
        IsPublished BIT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL
    );
END
GO

IF COL_LENGTH('edk.EdkSiteConfigs', 'EventId') IS NULL
BEGIN
    ALTER TABLE edk.EdkSiteConfigs ADD EventId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('edk.EdkSiteConfigs', 'SiteConfigJson') IS NULL
BEGIN
    ALTER TABLE edk.EdkSiteConfigs ADD SiteConfigJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_EdkSiteConfigs_SiteConfigJson DEFAULT(N'{}');
END
GO

IF COL_LENGTH('edk.EdkSiteConfigs', 'IsPublished') IS NULL
BEGIN
    ALTER TABLE edk.EdkSiteConfigs ADD IsPublished BIT NOT NULL CONSTRAINT DF_EdkSiteConfigs_IsPublished DEFAULT(0);
END
GO

IF COL_LENGTH('edk.EdkSiteConfigs', 'CreatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkSiteConfigs ADD CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkSiteConfigs_CreatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF COL_LENGTH('edk.EdkSiteConfigs', 'UpdatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkSiteConfigs ADD UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkSiteConfigs_UpdatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('edk.EdkSiteConfigs') AND name = 'EventId' AND is_nullable = 1)
BEGIN
    IF EXISTS (SELECT 1 FROM edk.EdkSiteConfigs WHERE EventId IS NULL)
    BEGIN
        THROW 51001, 'edk.EdkSiteConfigs contains NULL EventId values. Resolve data before enforcing NOT NULL.', 1;
    END

    ALTER TABLE edk.EdkSiteConfigs ALTER COLUMN EventId UNIQUEIDENTIFIER NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EdkSiteConfigs_Event' AND object_id = OBJECT_ID('edk.EdkSiteConfigs'))
BEGIN
    CREATE UNIQUE INDEX UX_EdkSiteConfigs_Event ON edk.EdkSiteConfigs(EventId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EdkSiteConfigs_Event')
BEGIN
    ALTER TABLE edk.EdkSiteConfigs WITH CHECK
    ADD CONSTRAINT FK_EdkSiteConfigs_Event
        FOREIGN KEY (EventId) REFERENCES edk.EdkEvents(Id);
END
GO

IF OBJECT_ID(N'edk.EdkRegistrations', N'U') IS NULL
BEGIN
    CREATE TABLE edk.EdkRegistrations
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        EventId UNIQUEIDENTIFIER NOT NULL,
        FullName NVARCHAR(200) NOT NULL,
        Phone NVARCHAR(32) NOT NULL,
        ParticipantStatus NVARCHAR(64) NOT NULL,
        AdditionalInfo NVARCHAR(2400) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL
    );
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'EventId') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD EventId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'FullName') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD FullName NVARCHAR(200) NOT NULL CONSTRAINT DF_EdkRegistrations_FullName DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'Phone') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD Phone NVARCHAR(32) NOT NULL CONSTRAINT DF_EdkRegistrations_Phone DEFAULT(N'');
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'ParticipantStatus') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD ParticipantStatus NVARCHAR(64) NOT NULL CONSTRAINT DF_EdkRegistrations_ParticipantStatus DEFAULT(N'adult');
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'AdditionalInfo') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD AdditionalInfo NVARCHAR(2400) NULL;
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'CreatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkRegistrations_CreatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF COL_LENGTH('edk.EdkRegistrations', 'UpdatedUtc') IS NULL
BEGIN
    ALTER TABLE edk.EdkRegistrations ADD UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_EdkRegistrations_UpdatedUtc DEFAULT(SYSDATETIMEOFFSET());
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('edk.EdkRegistrations') AND name = 'EventId' AND is_nullable = 1)
BEGIN
    IF EXISTS (SELECT 1 FROM edk.EdkRegistrations WHERE EventId IS NULL)
    BEGIN
        THROW 51002, 'edk.EdkRegistrations contains NULL EventId values. Resolve data before enforcing NOT NULL.', 1;
    END

    ALTER TABLE edk.EdkRegistrations ALTER COLUMN EventId UNIQUEIDENTIFIER NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EdkRegistrations_EventCreated' AND object_id = OBJECT_ID('edk.EdkRegistrations'))
BEGIN
    CREATE INDEX IX_EdkRegistrations_EventCreated ON edk.EdkRegistrations(EventId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_EdkRegistrations_Event')
BEGIN
    ALTER TABLE edk.EdkRegistrations WITH CHECK
    ADD CONSTRAINT FK_EdkRegistrations_Event
        FOREIGN KEY (EventId) REFERENCES edk.EdkEvents(Id);
END
GO

-- NOTE:
-- This patch only prepares dedicated EDK schema/tables.
-- Event seed data (edk26) is provisioned by application endpoint:
-- POST /edk/admin/events-limanowa/bootstrap-edk26
