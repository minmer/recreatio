-- Cogita Graph schema
-- Apply against the API database before starting the backend.

CREATE TABLE dbo.CgLibraries (
    Id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgLibraries PRIMARY KEY,
    OwnerAccountId UNIQUEIDENTIFIER NOT NULL,
    Name          NVARCHAR(200) NOT NULL,
    CreatedUtc    DATETIME2 NOT NULL,
    UpdatedUtc    DATETIME2 NOT NULL
);
CREATE INDEX IX_CgLibraries_OwnerAccountId ON dbo.CgLibraries (OwnerAccountId);

CREATE TABLE dbo.CgTypeDefs (
    Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgTypeDefs PRIMARY KEY,
    LibraryId  BIGINT NOT NULL,
    Name       NVARCHAR(200) NOT NULL,
    CreatedUtc DATETIME2 NOT NULL,
    UpdatedUtc DATETIME2 NOT NULL,
    CONSTRAINT UQ_CgTypeDefs_LibraryId_Name UNIQUE (LibraryId, Name)
);
CREATE INDEX IX_CgTypeDefs_LibraryId ON dbo.CgTypeDefs (LibraryId);

CREATE TABLE dbo.CgFieldDefs (
    Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgFieldDefs PRIMARY KEY,
    TypeDefId  BIGINT NOT NULL,
    Label      NVARCHAR(200) NOT NULL,
    SortOrder  INT NOT NULL,
    InputType  NVARCHAR(20) NOT NULL,   -- text | number | date | reference
    Multiple   BIT NOT NULL DEFAULT 0,
    IsOrdered  BIT NOT NULL DEFAULT 0,
    CreatedUtc DATETIME2 NOT NULL,
    UpdatedUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_CgFieldDefs_TypeDefId ON dbo.CgFieldDefs (TypeDefId);

CREATE TABLE dbo.CgFieldDefTargets (
    Id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgFieldDefTargets PRIMARY KEY,
    FieldDefId       BIGINT NOT NULL,
    TargetTypeDefId  BIGINT NOT NULL
);
CREATE INDEX IX_CgFieldDefTargets_FieldDefId ON dbo.CgFieldDefTargets (FieldDefId);
CREATE INDEX IX_CgFieldDefTargets_TargetTypeDefId ON dbo.CgFieldDefTargets (TargetTypeDefId);

CREATE TABLE dbo.CgEntities (
    Id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgEntities PRIMARY KEY,
    LibraryId  BIGINT NOT NULL,
    TypeDefId  BIGINT NOT NULL,
    CreatedUtc DATETIME2 NOT NULL,
    UpdatedUtc DATETIME2 NOT NULL
);
CREATE INDEX IX_CgEntities_LibraryId ON dbo.CgEntities (LibraryId);
CREATE INDEX IX_CgEntities_TypeDefId ON dbo.CgEntities (TypeDefId);

CREATE TABLE dbo.CgFieldValues (
    Id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CgFieldValues PRIMARY KEY,
    EntityId       BIGINT NOT NULL,
    FieldDefId     BIGINT NOT NULL,
    SortOrder      INT NOT NULL,
    EncryptedValue NVARCHAR(MAX) NULL,          -- encrypted text/number/date value
    SearchFloat    FLOAT NULL,                  -- order-preserving shifted float for range search
    SearchHash     VARBINARY(32) NULL,          -- keyed hash for reference exact-match search
    RefEntityId    BIGINT NULL                  -- plaintext FK for graph structure
);
CREATE INDEX IX_CgFieldValues_EntityId ON dbo.CgFieldValues (EntityId);
CREATE INDEX IX_CgFieldValues_FieldDefId_SearchFloat ON dbo.CgFieldValues (FieldDefId, SearchFloat)
    WHERE SearchFloat IS NOT NULL;
CREATE INDEX IX_CgFieldValues_FieldDefId_SearchHash ON dbo.CgFieldValues (FieldDefId, SearchHash)
    WHERE SearchHash IS NOT NULL;
CREATE INDEX IX_CgFieldValues_RefEntityId ON dbo.CgFieldValues (RefEntityId)
    WHERE RefEntityId IS NOT NULL;
