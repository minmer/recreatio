SET NOCOUNT ON;

IF SCHEMA_ID(N'pilgrimage') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA pilgrimage');
END
GO

/*
  Repair script for public registration persistence.
  Symptom: POST /pilgrimage/{slug}/public/registrations returns
  503 "Database error while saving registration."
*/

IF OBJECT_ID(N'pilgrimage.PilgrimageParticipants', N'U') IS NULL
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

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'EventId') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD EventId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'ParticipationVariant') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD ParticipationVariant NVARCHAR(32) NOT NULL CONSTRAINT DF_PilgrimageParticipants_ParticipationVariant DEFAULT N'full';
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'GroupName') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD GroupName NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'RegistrationStatus') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD RegistrationStatus NVARCHAR(32) NOT NULL CONSTRAINT DF_PilgrimageParticipants_RegistrationStatus DEFAULT N'pending';
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'PaymentStatus') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD PaymentStatus NVARCHAR(32) NOT NULL CONSTRAINT DF_PilgrimageParticipants_PaymentStatus DEFAULT N'pending';
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'AttendanceStatus') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD AttendanceStatus NVARCHAR(32) NOT NULL CONSTRAINT DF_PilgrimageParticipants_AttendanceStatus DEFAULT N'not-checked-in';
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'NeedsLodging') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD NeedsLodging BIT NOT NULL CONSTRAINT DF_PilgrimageParticipants_NeedsLodging DEFAULT 0;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'NeedsBaggageTransport') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD NeedsBaggageTransport BIT NOT NULL CONSTRAINT DF_PilgrimageParticipants_NeedsBaggageTransport DEFAULT 0;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'IsMinor') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD IsMinor BIT NOT NULL CONSTRAINT DF_PilgrimageParticipants_IsMinor DEFAULT 0;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'AcceptedTerms') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD AcceptedTerms BIT NOT NULL CONSTRAINT DF_PilgrimageParticipants_AcceptedTerms DEFAULT 0;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'AcceptedRodo') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD AcceptedRodo BIT NOT NULL CONSTRAINT DF_PilgrimageParticipants_AcceptedRodo DEFAULT 0;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'IdentityDigest') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD IdentityDigest VARBINARY(32) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'PayloadEnc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD PayloadEnc VARBINARY(MAX) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'PayloadDataKeyId') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD PayloadDataKeyId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'CreatedUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_PilgrimageParticipants_CreatedUtc DEFAULT SYSUTCDATETIME();
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'UpdatedUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants ADD UpdatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_PilgrimageParticipants_UpdatedUtc DEFAULT SYSUTCDATETIME();
END
GO

UPDATE pilgrimage.PilgrimageParticipants
SET IdentityDigest = ISNULL(IdentityDigest, 0x),
    PayloadEnc = ISNULL(PayloadEnc, 0x),
    CreatedUtc = ISNULL(CreatedUtc, SYSUTCDATETIME()),
    UpdatedUtc = ISNULL(UpdatedUtc, SYSUTCDATETIME()),
    ParticipationVariant = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(ParticipationVariant)), N''), N'full'), 32),
    RegistrationStatus = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(RegistrationStatus)), N''), N'pending'), 32),
    PaymentStatus = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(PaymentStatus)), N''), N'pending'), 32),
    AttendanceStatus = LEFT(ISNULL(NULLIF(LTRIM(RTRIM(AttendanceStatus)), N''), N'not-checked-in'), 32);
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipants', 'PayloadDataKeyId') IS NOT NULL
BEGIN
    UPDATE p
    SET p.PayloadDataKeyId = e.ParticipantDataKeyId
    FROM pilgrimage.PilgrimageParticipants p
    INNER JOIN pilgrimage.PilgrimageEvents e ON e.Id = p.EventId
    WHERE p.PayloadDataKeyId IS NULL;
END
GO

/* enforce column shapes used by EF insert */
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN ParticipationVariant NVARCHAR(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN GroupName NVARCHAR(120) NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN RegistrationStatus NVARCHAR(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN PaymentStatus NVARCHAR(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN AttendanceStatus NVARCHAR(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN NeedsLodging BIT NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN NeedsBaggageTransport BIT NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN IsMinor BIT NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN AcceptedTerms BIT NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN AcceptedRodo BIT NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN IdentityDigest VARBINARY(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN PayloadEnc VARBINARY(MAX) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN CreatedUtc DATETIMEOFFSET NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipants ALTER COLUMN UpdatedUtc DATETIMEOFFSET NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PilgrimageParticipants_Event'
      AND parent_object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipants'))
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipants
    WITH NOCHECK ADD CONSTRAINT FK_PilgrimageParticipants_Event
    FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PilgrimageParticipants_EventCreated' AND object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipants'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipants_EventCreated ON pilgrimage.PilgrimageParticipants(EventId, CreatedUtc);
END
GO

IF OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens', N'U') IS NULL
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

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'EventId') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD EventId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'ParticipantId') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD ParticipantId UNIQUEIDENTIFIER NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'TokenHash') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD TokenHash VARBINARY(32) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'ExpiresUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD ExpiresUtc DATETIMEOFFSET NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'LastUsedUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD LastUsedUtc DATETIMEOFFSET NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'RevokedUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD RevokedUtc DATETIMEOFFSET NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageParticipantAccessTokens', 'CreatedUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ADD CreatedUtc DATETIMEOFFSET NOT NULL CONSTRAINT DF_PilgrimageParticipantAccessTokens_CreatedUtc DEFAULT SYSUTCDATETIME();
END
GO

UPDATE pilgrimage.PilgrimageParticipantAccessTokens
SET TokenHash = ISNULL(TokenHash, 0x),
    ExpiresUtc = ISNULL(ExpiresUtc, DATEADD(DAY, 120, SYSUTCDATETIME())),
    CreatedUtc = ISNULL(CreatedUtc, SYSUTCDATETIME());
GO

ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ALTER COLUMN TokenHash VARBINARY(32) NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ALTER COLUMN ExpiresUtc DATETIMEOFFSET NOT NULL;
ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens ALTER COLUMN CreatedUtc DATETIMEOFFSET NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PilgrimageParticipantAccessTokens_Event'
      AND parent_object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens
    WITH NOCHECK ADD CONSTRAINT FK_PilgrimageParticipantAccessTokens_Event
    FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_PilgrimageParticipantAccessTokens_Participant'
      AND parent_object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    ALTER TABLE pilgrimage.PilgrimageParticipantAccessTokens
    WITH NOCHECK ADD CONSTRAINT FK_PilgrimageParticipantAccessTokens_Participant
    FOREIGN KEY (ParticipantId) REFERENCES pilgrimage.PilgrimageParticipants(Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_PilgrimageParticipantAccessTokens_TokenHash' AND object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    CREATE UNIQUE INDEX UX_PilgrimageParticipantAccessTokens_TokenHash
        ON pilgrimage.PilgrimageParticipantAccessTokens(TokenHash)
        WHERE TokenHash <> 0x;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_PilgrimageParticipantAccessTokens_EventParticipant' AND object_id = OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens'))
BEGIN
    CREATE INDEX IX_PilgrimageParticipantAccessTokens_EventParticipant
        ON pilgrimage.PilgrimageParticipantAccessTokens(EventId, ParticipantId);
END
GO

/* diagnostics */
PRINT N'=== Registration schema diagnostics ===';
SELECT
    t.name AS TableName,
    c.column_id,
    c.name AS ColumnName,
    ty.name AS TypeName,
    c.max_length,
    c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.schema_id = SCHEMA_ID(N'pilgrimage')
  AND t.name IN (N'PilgrimageParticipants', N'PilgrimageParticipantAccessTokens')
ORDER BY t.name, c.column_id;

SELECT
    i.name AS IndexName,
    OBJECT_NAME(i.object_id) AS TableName,
    i.is_unique
FROM sys.indexes i
WHERE i.object_id IN (
    OBJECT_ID(N'pilgrimage.PilgrimageParticipants'),
    OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens'))
  AND i.name IS NOT NULL
ORDER BY TableName, IndexName;
