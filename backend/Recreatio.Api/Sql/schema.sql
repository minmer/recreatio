-- ReCreatio schema (fresh install)
-- Drops all known tables and recreates the schema from scratch.

SET NOCOUNT ON;

DECLARE @dropSql NVARCHAR(MAX) = N'';

SELECT @dropSql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + N'.' + QUOTENAME(OBJECT_NAME(parent_object_id))
    + N' DROP CONSTRAINT ' + QUOTENAME(name) + N';' + CHAR(13)
FROM sys.foreign_keys;

IF (@dropSql <> N'')
BEGIN
    EXEC sp_executesql @dropSql;
END

IF OBJECT_ID(N'dbo.RoleRecoveryApprovals', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryApprovals;
IF OBJECT_ID(N'dbo.RoleRecoveryRequests', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryRequests;
IF OBJECT_ID(N'dbo.RoleRecoveryKeys', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryKeys;
IF OBJECT_ID(N'dbo.RoleRecoveryShares', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryShares;
IF OBJECT_ID(N'dbo.RoleFields', N'U') IS NOT NULL DROP TABLE dbo.RoleFields;
IF OBJECT_ID(N'dbo.CogitaInfoLinkMultis', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfoLinkMultis;
IF OBJECT_ID(N'dbo.CogitaInfoLinkSingles', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfoLinkSingles;
IF OBJECT_ID(N'dbo.CogitaCollectionGraphEdges', N'U') IS NOT NULL DROP TABLE dbo.CogitaCollectionGraphEdges;
IF OBJECT_ID(N'dbo.CogitaCollectionGraphNodes', N'U') IS NOT NULL DROP TABLE dbo.CogitaCollectionGraphNodes;
IF OBJECT_ID(N'dbo.CogitaCollectionGraphs', N'U') IS NOT NULL DROP TABLE dbo.CogitaCollectionGraphs;
IF OBJECT_ID(N'dbo.CogitaDependencyGraphEdges', N'U') IS NOT NULL DROP TABLE dbo.CogitaDependencyGraphEdges;
IF OBJECT_ID(N'dbo.CogitaDependencyGraphNodes', N'U') IS NOT NULL DROP TABLE dbo.CogitaDependencyGraphNodes;
IF OBJECT_ID(N'dbo.CogitaDependencyGraphs', N'U') IS NOT NULL DROP TABLE dbo.CogitaDependencyGraphs;
IF OBJECT_ID(N'dbo.CogitaConnectionItems', N'U') IS NOT NULL DROP TABLE dbo.CogitaConnectionItems;
IF OBJECT_ID(N'dbo.CogitaConnections', N'U') IS NOT NULL DROP TABLE dbo.CogitaConnections;
IF OBJECT_ID(N'dbo.CogitaMusicFragments', N'U') IS NOT NULL DROP TABLE dbo.CogitaMusicFragments;
IF OBJECT_ID(N'dbo.CogitaMusicPieces', N'U') IS NOT NULL DROP TABLE dbo.CogitaMusicPieces;
IF OBJECT_ID(N'dbo.CogitaQuotes', N'U') IS NOT NULL DROP TABLE dbo.CogitaQuotes;
IF OBJECT_ID(N'dbo.CogitaSources', N'U') IS NOT NULL DROP TABLE dbo.CogitaSources;
IF OBJECT_ID(N'dbo.CogitaGeoFeatures', N'U') IS NOT NULL DROP TABLE dbo.CogitaGeoFeatures;
IF OBJECT_ID(N'dbo.CogitaMedia', N'U') IS NOT NULL DROP TABLE dbo.CogitaMedia;
IF OBJECT_ID(N'dbo.CogitaWorks', N'U') IS NOT NULL DROP TABLE dbo.CogitaWorks;
IF OBJECT_ID(N'dbo.CogitaPhones', N'U') IS NOT NULL DROP TABLE dbo.CogitaPhones;
IF OBJECT_ID(N'dbo.CogitaEmails', N'U') IS NOT NULL DROP TABLE dbo.CogitaEmails;
IF OBJECT_ID(N'dbo.CogitaAddresses', N'U') IS NOT NULL DROP TABLE dbo.CogitaAddresses;
IF OBJECT_ID(N'dbo.CogitaPersons', N'U') IS NOT NULL DROP TABLE dbo.CogitaPersons;
IF OBJECT_ID(N'dbo.CogitaCollectives', N'U') IS NOT NULL DROP TABLE dbo.CogitaCollectives;
IF OBJECT_ID(N'dbo.CogitaInstitutions', N'U') IS NOT NULL DROP TABLE dbo.CogitaInstitutions;
IF OBJECT_ID(N'dbo.CogitaOrcids', N'U') IS NOT NULL DROP TABLE dbo.CogitaOrcids;
IF OBJECT_ID(N'dbo.CogitaTopics', N'U') IS NOT NULL DROP TABLE dbo.CogitaTopics;
IF OBJECT_ID(N'dbo.CogitaSentences', N'U') IS NOT NULL DROP TABLE dbo.CogitaSentences;
IF OBJECT_ID(N'dbo.CogitaWords', N'U') IS NOT NULL DROP TABLE dbo.CogitaWords;
IF OBJECT_ID(N'dbo.CogitaWordLanguages', N'U') IS NOT NULL DROP TABLE dbo.CogitaWordLanguages;
IF OBJECT_ID(N'dbo.CogitaLanguages', N'U') IS NOT NULL DROP TABLE dbo.CogitaLanguages;
IF OBJECT_ID(N'dbo.CogitaInfos', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfos;
IF OBJECT_ID(N'dbo.CogitaComputedInfos', N'U') IS NOT NULL DROP TABLE dbo.CogitaComputedInfos;
IF OBJECT_ID(N'dbo.CogitaLibraries', N'U') IS NOT NULL DROP TABLE dbo.CogitaLibraries;
IF OBJECT_ID(N'dbo.CogitaInfoSearchIndexes', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfoSearchIndexes;
IF OBJECT_ID(N'dbo.CogitaEntitySearchDocuments', N'U') IS NOT NULL DROP TABLE dbo.CogitaEntitySearchDocuments;
IF OBJECT_ID(N'dbo.CogitaReviewOutcomes', N'U') IS NOT NULL DROP TABLE dbo.CogitaReviewOutcomes;
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionShares;
IF OBJECT_ID(N'dbo.CogitaItemDependencies', N'U') IS NOT NULL DROP TABLE dbo.CogitaItemDependencies;
IF OBJECT_ID(N'dbo.PendingDataShares', N'U') IS NOT NULL DROP TABLE dbo.PendingDataShares;
IF OBJECT_ID(N'dbo.DataKeyGrants', N'U') IS NOT NULL DROP TABLE dbo.DataKeyGrants;
IF OBJECT_ID(N'dbo.DataItems', N'U') IS NOT NULL DROP TABLE dbo.DataItems;
IF OBJECT_ID(N'dbo.SharedViews', N'U') IS NOT NULL DROP TABLE dbo.SharedViews;
IF OBJECT_ID(N'dbo.ParishOfferings', N'U') IS NOT NULL DROP TABLE dbo.ParishOfferings;
IF OBJECT_ID(N'dbo.ParishIntentions', N'U') IS NOT NULL DROP TABLE dbo.ParishIntentions;
IF OBJECT_ID(N'dbo.ParishMasses', N'U') IS NOT NULL DROP TABLE dbo.ParishMasses;
IF OBJECT_ID(N'dbo.ParishSiteConfigs', N'U') IS NOT NULL DROP TABLE dbo.ParishSiteConfigs;
IF OBJECT_ID(N'dbo.ParishLedger', N'U') IS NOT NULL DROP TABLE dbo.ParishLedger;
IF OBJECT_ID(N'dbo.Parishes', N'U') IS NOT NULL DROP TABLE dbo.Parishes;
IF OBJECT_ID(N'dbo.Memberships', N'U') IS NOT NULL DROP TABLE dbo.Memberships;
IF OBJECT_ID(N'dbo.PendingRoleShares', N'U') IS NOT NULL DROP TABLE dbo.PendingRoleShares;
IF OBJECT_ID(N'dbo.RoleEdges', N'U') IS NOT NULL DROP TABLE dbo.RoleEdges;
IF OBJECT_ID(N'dbo.Sessions', N'U') IS NOT NULL DROP TABLE dbo.Sessions;
IF OBJECT_ID(N'dbo.KeyEntryBindings', N'U') IS NOT NULL DROP TABLE dbo.KeyEntryBindings;
IF OBJECT_ID(N'dbo.Keys', N'U') IS NOT NULL DROP TABLE dbo.Keys;
IF OBJECT_ID(N'dbo.UserAccounts', N'U') IS NOT NULL DROP TABLE dbo.UserAccounts;
IF OBJECT_ID(N'dbo.Roles', N'U') IS NOT NULL DROP TABLE dbo.Roles;
IF OBJECT_ID(N'dbo.BusinessLedger', N'U') IS NOT NULL DROP TABLE dbo.BusinessLedger;
IF OBJECT_ID(N'dbo.AuthLedger', N'U') IS NOT NULL DROP TABLE dbo.AuthLedger;
IF OBJECT_ID(N'dbo.KeyLedger', N'U') IS NOT NULL DROP TABLE dbo.KeyLedger;
GO

CREATE TABLE dbo.Roles
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    EncryptedRoleBlob VARBINARY(MAX) NOT NULL,
    PublicSigningKey VARBINARY(MAX) NULL,
    PublicSigningKeyAlg NVARCHAR(64) NULL,
    PublicEncryptionKey VARBINARY(MAX) NULL,
    PublicEncryptionKeyAlg NVARCHAR(64) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL
);
GO

CREATE TABLE dbo.KeyLedger
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TimestampUtc DATETIMEOFFSET NOT NULL,
    EventType NVARCHAR(64) NOT NULL,
    Actor NVARCHAR(128) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    PreviousHash VARBINARY(64) NOT NULL,
    Hash VARBINARY(64) NOT NULL,
    SignerRoleId UNIQUEIDENTIFIER NULL,
    Signature VARBINARY(MAX) NULL,
    SignatureAlg NVARCHAR(64) NULL
);
GO

CREATE TABLE dbo.AuthLedger
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TimestampUtc DATETIMEOFFSET NOT NULL,
    EventType NVARCHAR(64) NOT NULL,
    Actor NVARCHAR(128) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    PreviousHash VARBINARY(64) NOT NULL,
    Hash VARBINARY(64) NOT NULL,
    SignerRoleId UNIQUEIDENTIFIER NULL,
    Signature VARBINARY(MAX) NULL,
    SignatureAlg NVARCHAR(64) NULL
);
GO

CREATE TABLE dbo.BusinessLedger
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TimestampUtc DATETIMEOFFSET NOT NULL,
    EventType NVARCHAR(64) NOT NULL,
    Actor NVARCHAR(128) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    PreviousHash VARBINARY(64) NOT NULL,
    Hash VARBINARY(64) NOT NULL,
    SignerRoleId UNIQUEIDENTIFIER NULL,
    Signature VARBINARY(MAX) NULL,
    SignatureAlg NVARCHAR(64) NULL
);
GO

CREATE TABLE dbo.Parishes
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Slug NVARCHAR(80) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    Location NVARCHAR(200) NOT NULL,
    Theme NVARCHAR(32) NOT NULL,
    HeroImageUrl NVARCHAR(256) NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    AdminRoleId UNIQUEIDENTIFIER NOT NULL,
    PriestRoleId UNIQUEIDENTIFIER NOT NULL,
    OfficeRoleId UNIQUEIDENTIFIER NOT NULL,
    FinanceRoleId UNIQUEIDENTIFIER NOT NULL,
    PublicRoleId UNIQUEIDENTIFIER NOT NULL,
    IntentionInternalDataItemId UNIQUEIDENTIFIER NOT NULL,
    IntentionPublicDataItemId UNIQUEIDENTIFIER NOT NULL,
    OfferingDataItemId UNIQUEIDENTIFIER NOT NULL,
    IntentionInternalKeyId UNIQUEIDENTIFIER NOT NULL,
    IntentionPublicKeyId UNIQUEIDENTIFIER NOT NULL,
    OfferingKeyId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT UX_Parishes_Slug UNIQUE (Slug),
    CONSTRAINT FK_Parishes_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Parishes_AdminRole FOREIGN KEY (AdminRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Parishes_PriestRole FOREIGN KEY (PriestRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Parishes_OfficeRole FOREIGN KEY (OfficeRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Parishes_FinanceRole FOREIGN KEY (FinanceRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Parishes_PublicRole FOREIGN KEY (PublicRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.ParishSiteConfigs
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    HomepageConfigJson NVARCHAR(MAX) NOT NULL,
    IsPublished BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT UX_ParishSiteConfigs_Parish UNIQUE (ParishId),
    CONSTRAINT FK_ParishSiteConfigs_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
);
GO

CREATE TABLE dbo.ParishLedger
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    TimestampUtc DATETIMEOFFSET NOT NULL,
    EventType NVARCHAR(64) NOT NULL,
    Actor NVARCHAR(128) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    PreviousHash VARBINARY(64) NOT NULL,
    Hash VARBINARY(64) NOT NULL,
    SignerRoleId UNIQUEIDENTIFIER NULL,
    Signature VARBINARY(MAX) NULL,
    SignatureAlg NVARCHAR(64) NULL,
    CONSTRAINT FK_ParishLedger_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
);
GO

CREATE TABLE dbo.ParishIntentions
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    MassDateTime DATETIMEOFFSET NOT NULL,
    ChurchName NVARCHAR(128) NOT NULL,
    PublicText NVARCHAR(512) NOT NULL,
    InternalTextEnc VARBINARY(MAX) NOT NULL,
    DonorRefEnc VARBINARY(MAX) NOT NULL,
    InternalDataKeyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(32) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_ParishIntentions_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
);
GO

CREATE TABLE dbo.ParishOfferings
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    IntentionId UNIQUEIDENTIFIER NOT NULL,
    AmountEnc VARBINARY(MAX) NOT NULL,
    Currency NVARCHAR(16) NOT NULL,
    Date DATETIMEOFFSET NOT NULL,
    DonorRefEnc VARBINARY(MAX) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_ParishOfferings_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
    CONSTRAINT FK_ParishOfferings_Intention FOREIGN KEY (IntentionId) REFERENCES dbo.ParishIntentions(Id)
);
GO

CREATE TABLE dbo.ParishMasses
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    MassDateTime DATETIMEOFFSET NOT NULL,
    ChurchName NVARCHAR(128) NOT NULL,
    Title NVARCHAR(256) NOT NULL,
    Note NVARCHAR(512) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_ParishMasses_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
);
GO

CREATE TABLE dbo.UserAccounts
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LoginId NVARCHAR(256) NOT NULL,
    DisplayName NVARCHAR(128) NULL,
    UserSalt VARBINARY(MAX) NOT NULL,
    StoredH4 VARBINARY(MAX) NOT NULL,
    State INT NOT NULL,
    FailedLoginCount INT NOT NULL,
    LockedUntilUtc DATETIMEOFFSET NULL,
    MasterRoleId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_UserAccounts_MasterRole FOREIGN KEY (MasterRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_UserAccounts_LoginId ON dbo.UserAccounts(LoginId);
GO

CREATE TABLE dbo.Keys
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    KeyType INT NOT NULL,
    OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
    Version INT NOT NULL,
    EncryptedKeyBlob VARBINARY(MAX) NOT NULL,
    ScopeType NVARCHAR(64) NOT NULL,
    ScopeSubtype NVARCHAR(128) NULL,
    BoundEntryId UNIQUEIDENTIFIER NULL,
    LedgerRefId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_Keys_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Keys_Ledger FOREIGN KEY (LedgerRefId) REFERENCES dbo.KeyLedger(Id)
);
GO

CREATE TABLE dbo.KeyEntryBindings
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    KeyEntryId UNIQUEIDENTIFIER NOT NULL,
    EntryId UNIQUEIDENTIFIER NOT NULL,
    EntryType NVARCHAR(64) NOT NULL,
    EntrySubtype NVARCHAR(128) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_KeyEntryBindings_Key FOREIGN KEY (KeyEntryId) REFERENCES dbo.Keys(Id)
);
GO

CREATE INDEX IX_KeyEntryBindings_KeyEntryId ON dbo.KeyEntryBindings(KeyEntryId);
GO

CREATE INDEX IX_KeyEntryBindings_EntryId ON dbo.KeyEntryBindings(EntryId);
GO

CREATE TABLE dbo.Sessions
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserId UNIQUEIDENTIFIER NOT NULL,
    SessionId NVARCHAR(128) NOT NULL,
    IsSecureMode BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    LastActivityUtc DATETIMEOFFSET NOT NULL,
    DeviceInfo NVARCHAR(256) NULL,
    IsRevoked BIT NOT NULL,
    CONSTRAINT FK_Sessions_User FOREIGN KEY (UserId) REFERENCES dbo.UserAccounts(Id)
);
GO

CREATE UNIQUE INDEX UX_Sessions_SessionId ON dbo.Sessions(SessionId);
GO

CREATE TABLE dbo.RoleEdges
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParentRoleId UNIQUEIDENTIFIER NOT NULL,
    ChildRoleId UNIQUEIDENTIFIER NOT NULL,
    RelationshipType NVARCHAR(64) NULL,
    EncryptedRelationshipType VARBINARY(MAX) NOT NULL,
    RelationshipTypeHash VARBINARY(64) NOT NULL,
    EncryptedReadKeyCopy VARBINARY(MAX) NOT NULL,
    EncryptedWriteKeyCopy VARBINARY(MAX) NULL,
    EncryptedOwnerKeyCopy VARBINARY(MAX) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_RoleEdges_ParentRole FOREIGN KEY (ParentRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleEdges_ChildRole FOREIGN KEY (ChildRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.PendingRoleShares
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    SourceRoleId UNIQUEIDENTIFIER NOT NULL,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    RelationshipType NVARCHAR(64) NOT NULL,
    EncryptedReadKeyBlob VARBINARY(MAX) NOT NULL,
    EncryptedWriteKeyBlob VARBINARY(MAX) NULL,
    EncryptedOwnerKeyBlob VARBINARY(MAX) NULL,
    EncryptionAlg NVARCHAR(64) NOT NULL,
    Status NVARCHAR(32) NOT NULL,
    LedgerRefId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    AcceptedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_PendingRoleShares_SourceRole FOREIGN KEY (SourceRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_PendingRoleShares_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_PendingRoleShares_TargetRole_Status ON dbo.PendingRoleShares(TargetRoleId, Status);
GO

CREATE TABLE dbo.Memberships
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    UserId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    RelationshipType NVARCHAR(64) NOT NULL,
    EncryptedReadKeyCopy VARBINARY(MAX) NOT NULL,
    EncryptedWriteKeyCopy VARBINARY(MAX) NULL,
    EncryptedOwnerKeyCopy VARBINARY(MAX) NULL,
    LedgerRefId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_Memberships_User FOREIGN KEY (UserId) REFERENCES dbo.UserAccounts(Id),
    CONSTRAINT FK_Memberships_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Memberships_Ledger FOREIGN KEY (LedgerRefId) REFERENCES dbo.KeyLedger(Id)
);
GO

CREATE TABLE dbo.SharedViews
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
    ViewRoleId UNIQUEIDENTIFIER NOT NULL,
    EncViewRoleKey VARBINARY(MAX) NOT NULL,
    SharedViewSecretHash VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    RevokedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_SharedViews_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_SharedViews_ViewRole FOREIGN KEY (ViewRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.RoleFields
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    FieldType NVARCHAR(64) NULL,
    EncryptedFieldType VARBINARY(MAX) NOT NULL,
    FieldTypeHash VARBINARY(64) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedValue VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_RoleFields_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleFields_Key FOREIGN KEY (DataKeyId) REFERENCES dbo.Keys(Id)
);
GO

CREATE UNIQUE INDEX UX_RoleFields_Role_FieldTypeHash ON dbo.RoleFields(RoleId, FieldTypeHash);
GO

CREATE TABLE dbo.DataItems
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
    ItemType NVARCHAR(32) NULL,
    ItemName NVARCHAR(128) NULL,
    EncryptedItemType VARBINARY(MAX) NOT NULL,
    EncryptedItemName VARBINARY(MAX) NOT NULL,
    EncryptedValue VARBINARY(MAX) NULL,
    PublicSigningKey VARBINARY(MAX) NOT NULL,
    PublicSigningKeyAlg NVARCHAR(64) NOT NULL,
    DataSignature VARBINARY(MAX) NULL,
    DataSignatureAlg NVARCHAR(64) NULL,
    DataSignatureRoleId UNIQUEIDENTIFIER NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_DataItems_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_DataItems_OwnerRole ON dbo.DataItems(OwnerRoleId);
GO

CREATE TABLE dbo.DataKeyGrants
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataItemId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    PermissionType NVARCHAR(32) NOT NULL,
    EncryptedDataKeyBlob VARBINARY(MAX) NOT NULL,
    EncryptedSigningKeyBlob VARBINARY(MAX) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    RevokedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_DataKeyGrants_DataItem FOREIGN KEY (DataItemId) REFERENCES dbo.DataItems(Id),
    CONSTRAINT FK_DataKeyGrants_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_DataKeyGrants_DataItem_Role ON dbo.DataKeyGrants(DataItemId, RoleId);
GO

CREATE INDEX IX_DataKeyGrants_Role ON dbo.DataKeyGrants(RoleId);
GO

CREATE TABLE dbo.PendingDataShares
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataItemId UNIQUEIDENTIFIER NOT NULL,
    SourceRoleId UNIQUEIDENTIFIER NOT NULL,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    PermissionType NVARCHAR(32) NOT NULL,
    EncryptedDataKeyBlob VARBINARY(MAX) NOT NULL,
    EncryptedSigningKeyBlob VARBINARY(MAX) NULL,
    EncryptionAlg NVARCHAR(64) NOT NULL,
    Status NVARCHAR(32) NOT NULL,
    LedgerRefId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    AcceptedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_PendingDataShares_DataItem FOREIGN KEY (DataItemId) REFERENCES dbo.DataItems(Id),
    CONSTRAINT FK_PendingDataShares_SourceRole FOREIGN KEY (SourceRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_PendingDataShares_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_PendingDataShares_Ledger FOREIGN KEY (LedgerRefId) REFERENCES dbo.KeyLedger(Id)
);
GO

CREATE INDEX IX_PendingDataShares_Target_Status ON dbo.PendingDataShares(TargetRoleId, Status);
GO

-- Recovery key drafts are client-only; no server-side plan tables.

CREATE TABLE dbo.RoleRecoveryShares
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    SharedWithRoleId UNIQUEIDENTIFIER NOT NULL,
    EncryptedShareBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    RevokedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_RoleRecoveryShares_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleRecoveryShares_SharedWithRole FOREIGN KEY (SharedWithRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_RoleRecoveryShares_Target_SharedWith ON dbo.RoleRecoveryShares(TargetRoleId, SharedWithRoleId);
GO

CREATE TABLE dbo.RoleRecoveryKeys
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    EncryptedServerShare VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    RevokedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_RoleRecoveryKeys_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.RoleRecoveryRequests
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    InitiatorRoleId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(32) NOT NULL,
    RequiredApprovals INT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CanceledUtc DATETIMEOFFSET NULL,
    CompletedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_RoleRecoveryRequests_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleRecoveryRequests_InitiatorRole FOREIGN KEY (InitiatorRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE TABLE dbo.RoleRecoveryApprovals
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    RequestId UNIQUEIDENTIFIER NOT NULL,
    ApproverRoleId UNIQUEIDENTIFIER NOT NULL,
    EncryptedApprovalBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_RoleRecoveryApprovals_Request FOREIGN KEY (RequestId) REFERENCES dbo.RoleRecoveryRequests(Id),
    CONSTRAINT FK_RoleRecoveryApprovals_ApproverRole FOREIGN KEY (ApproverRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_RoleRecoveryApprovals_Request_Approver ON dbo.RoleRecoveryApprovals(RequestId, ApproverRoleId);
GO

CREATE TABLE dbo.CogitaLibraries
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaLibraries_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaLibraries_RoleId ON dbo.CogitaLibraries(RoleId);
GO

CREATE TABLE dbo.CogitaInfos
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    InfoType NVARCHAR(64) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaInfos_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
);

CREATE TABLE dbo.CogitaInfoSearchIndexes
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    InfoId UNIQUEIDENTIFIER NOT NULL,
    InfoType NVARCHAR(64) NOT NULL,
    Label NVARCHAR(512) NOT NULL,
        LabelNormalized NVARCHAR(256) NOT NULL,
    LabelHash VARBINARY(32) NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL
);
CREATE INDEX IX_CogitaInfoSearchIndexes_LibraryTypeLabel ON dbo.CogitaInfoSearchIndexes (LibraryId, InfoType, LabelNormalized);
CREATE UNIQUE INDEX IX_CogitaInfoSearchIndexes_LibraryInfo ON dbo.CogitaInfoSearchIndexes (LibraryId, InfoId);
GO

CREATE TABLE dbo.CogitaEntitySearchDocuments
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceKind NVARCHAR(32) NOT NULL,
    SourceId UNIQUEIDENTIFIER NOT NULL,
    EntityKind NVARCHAR(32) NOT NULL,
    EntityType NVARCHAR(64) NOT NULL,
    InfoId UNIQUEIDENTIFIER NULL,
    ConnectionId UNIQUEIDENTIFIER NULL,
    Title NVARCHAR(512) NOT NULL,
    TitleNormalized NVARCHAR(256) NOT NULL,
    Summary NVARCHAR(1024) NOT NULL,
    SearchTextNormalized NVARCHAR(MAX) NOT NULL,
    FilterTextNormalized NVARCHAR(MAX) NOT NULL,
    SourceUpdatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL
);
CREATE INDEX IX_CogitaEntitySearchDocuments_LibraryTypeTitle ON dbo.CogitaEntitySearchDocuments (LibraryId, EntityType, TitleNormalized);
CREATE UNIQUE INDEX IX_CogitaEntitySearchDocuments_LibrarySource ON dbo.CogitaEntitySearchDocuments (LibraryId, SourceKind, SourceId);
CREATE INDEX IX_CogitaEntitySearchDocuments_LibrarySourceUpdated ON dbo.CogitaEntitySearchDocuments (LibraryId, SourceUpdatedUtc);
GO

CREATE INDEX IX_CogitaInfos_Library_Type ON dbo.CogitaInfos(LibraryId, InfoType);
GO

CREATE INDEX IX_CogitaInfos_Library_Type_Created ON dbo.CogitaInfos(LibraryId, InfoType, CreatedUtc, Id);
GO

CREATE TABLE dbo.CogitaLanguages
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaLanguages_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaWords
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaWords_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaWordLanguages
(
    LanguageInfoId UNIQUEIDENTIFIER NOT NULL,
    WordInfoId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT PK_CogitaWordLanguages PRIMARY KEY (LanguageInfoId, WordInfoId),
    CONSTRAINT FK_CogitaWordLanguages_Language FOREIGN KEY (LanguageInfoId) REFERENCES dbo.CogitaInfos(Id),
    CONSTRAINT FK_CogitaWordLanguages_Word FOREIGN KEY (WordInfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE INDEX IX_CogitaWordLanguages_Word ON dbo.CogitaWordLanguages(WordInfoId);
GO

CREATE TABLE dbo.CogitaSentences
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaSentences_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaTopics
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaTopics_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollections' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaCollections
    (
        InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaCollections_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

CREATE TABLE dbo.CogitaPersons
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaPersons_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaInstitutions
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaInstitutions_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaCollectives
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCollectives_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaOrcids
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaOrcids_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaAddresses
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaAddresses_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaEmails
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaEmails_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaPhones
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaPhones_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO


CREATE TABLE dbo.CogitaWorks
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaWorks_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaMedia
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaMedia_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaGeoFeatures
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaGeoFeatures_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaMusicPieces
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaMusicPieces_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaMusicFragments
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaMusicFragments_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE TABLE dbo.CogitaSources
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaSources_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO


CREATE TABLE dbo.CogitaQuotes
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaQuotes_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaComputedInfos' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaComputedInfos
    (
        InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaComputedInfos_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

CREATE TABLE dbo.CogitaConnections
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    ConnectionType NVARCHAR(96) NOT NULL,
    ConnectionTypeHash VARBINARY(64) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaConnections_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
);
GO

CREATE INDEX IX_CogitaConnections_Library_Type ON dbo.CogitaConnections(LibraryId, ConnectionType);
GO

CREATE INDEX IX_CogitaConnections_Library_Type_Created ON dbo.CogitaConnections(LibraryId, ConnectionType, CreatedUtc, Id);
GO

CREATE TABLE dbo.CogitaConnectionItems
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ConnectionId UNIQUEIDENTIFIER NOT NULL,
    InfoId UNIQUEIDENTIFIER NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT FK_CogitaConnectionItems_Connection FOREIGN KEY (ConnectionId) REFERENCES dbo.CogitaConnections(Id),
    CONSTRAINT FK_CogitaConnectionItems_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaConnectionItems_Link ON dbo.CogitaConnectionItems(ConnectionId, InfoId);
GO

CREATE TABLE dbo.CogitaInfoLinkSingles
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    InfoId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetInfoId UNIQUEIDENTIFIER NOT NULL,
    IsRequired BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaInfoLinkSingles_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
    CONSTRAINT FK_CogitaInfoLinkSingles_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id),
    CONSTRAINT FK_CogitaInfoLinkSingles_Target FOREIGN KEY (TargetInfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaInfoLinkSingles_PerField ON dbo.CogitaInfoLinkSingles(LibraryId, InfoId, FieldKey);
GO

CREATE INDEX IX_CogitaInfoLinkSingles_FieldTarget ON dbo.CogitaInfoLinkSingles(LibraryId, FieldKey, TargetInfoId);
GO

CREATE TABLE dbo.CogitaInfoLinkMultis
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    InfoId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetInfoId UNIQUEIDENTIFIER NOT NULL,
    SortOrder INT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaInfoLinkMultis_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
    CONSTRAINT FK_CogitaInfoLinkMultis_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id),
    CONSTRAINT FK_CogitaInfoLinkMultis_Target FOREIGN KEY (TargetInfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaInfoLinkMultis_PerFieldTarget ON dbo.CogitaInfoLinkMultis(LibraryId, InfoId, FieldKey, TargetInfoId);
GO

CREATE INDEX IX_CogitaInfoLinkMultis_FieldTarget ON dbo.CogitaInfoLinkMultis(LibraryId, FieldKey, TargetInfoId);
GO

CREATE INDEX IX_CogitaInfoLinkMultis_InfoSort ON dbo.CogitaInfoLinkMultis(LibraryId, InfoId, SortOrder);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollectionItems' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaCollectionItems
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        CollectionInfoId UNIQUEIDENTIFIER NOT NULL,
        ItemType NVARCHAR(32) NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        SortOrder INT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaCollectionItems_Collection FOREIGN KEY (CollectionInfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollectionDependencies' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaCollectionDependencies
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParentCollectionInfoId UNIQUEIDENTIFIER NOT NULL,
        ChildCollectionInfoId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaCollectionDependencies_Parent FOREIGN KEY (ParentCollectionInfoId) REFERENCES dbo.CogitaInfos(Id),
        CONSTRAINT FK_CogitaCollectionDependencies_Child FOREIGN KEY (ChildCollectionInfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaCollectionDependencies_Link' AND object_id = OBJECT_ID('dbo.CogitaCollectionDependencies'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaCollectionDependencies_Link ON dbo.CogitaCollectionDependencies(ParentCollectionInfoId, ChildCollectionInfoId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCollectionDependencies_Child' AND object_id = OBJECT_ID('dbo.CogitaCollectionDependencies'))
BEGIN
    CREATE INDEX IX_CogitaCollectionDependencies_Child ON dbo.CogitaCollectionDependencies(ChildCollectionInfoId);
END
GO

CREATE TABLE dbo.CogitaCollectionGraphs
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCollectionGraphs PRIMARY KEY,
    CollectionInfoId UNIQUEIDENTIFIER NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(8000) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCollectionGraphs_Collection FOREIGN KEY (CollectionInfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaCollectionGraphs_Collection ON dbo.CogitaCollectionGraphs(CollectionInfoId);
GO

CREATE TABLE dbo.CogitaCollectionGraphNodes
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCollectionGraphNodes PRIMARY KEY,
    GraphId UNIQUEIDENTIFIER NOT NULL,
    NodeType NVARCHAR(64) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(8000) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCollectionGraphNodes_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaCollectionGraphs(Id)
);
GO

CREATE INDEX IX_CogitaCollectionGraphNodes_Graph ON dbo.CogitaCollectionGraphNodes(GraphId);
GO

CREATE TABLE dbo.CogitaCollectionGraphEdges
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCollectionGraphEdges PRIMARY KEY,
    GraphId UNIQUEIDENTIFIER NOT NULL,
    FromNodeId UNIQUEIDENTIFIER NOT NULL,
    FromPort NVARCHAR(64) NULL,
    ToNodeId UNIQUEIDENTIFIER NOT NULL,
    ToPort NVARCHAR(64) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCollectionGraphEdges_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaCollectionGraphs(Id)
);
GO

CREATE INDEX IX_CogitaCollectionGraphEdges_Graph ON dbo.CogitaCollectionGraphEdges(GraphId);
GO

CREATE TABLE dbo.CogitaDependencyGraphs
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyGraphs PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(8000) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyGraphs_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaDependencyGraphs_Library ON dbo.CogitaDependencyGraphs(LibraryId);
GO

CREATE TABLE dbo.CogitaDependencyGraphNodes
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyGraphNodes PRIMARY KEY,
    GraphId UNIQUEIDENTIFIER NOT NULL,
    NodeType NVARCHAR(64) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(8000) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyGraphNodes_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaDependencyGraphs(Id)
);
GO

CREATE INDEX IX_CogitaDependencyGraphNodes_Graph ON dbo.CogitaDependencyGraphNodes(GraphId);
GO

CREATE TABLE dbo.CogitaDependencyGraphEdges
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyGraphEdges PRIMARY KEY,
    GraphId UNIQUEIDENTIFIER NOT NULL,
    FromNodeId UNIQUEIDENTIFIER NOT NULL,
    ToNodeId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyGraphEdges_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaDependencyGraphs(Id)
);
GO

CREATE INDEX IX_CogitaDependencyGraphEdges_Graph ON dbo.CogitaDependencyGraphEdges(GraphId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaCollectionItems_Link' AND object_id = OBJECT_ID('dbo.CogitaCollectionItems'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaCollectionItems_Link ON dbo.CogitaCollectionItems(CollectionInfoId, ItemType, ItemId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCollectionItems_Collection_Order' AND object_id = OBJECT_ID('dbo.CogitaCollectionItems'))
BEGIN
    CREATE INDEX IX_CogitaCollectionItems_Collection_Order ON dbo.CogitaCollectionItems(CollectionInfoId, SortOrder);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaReviewEvents' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaReviewEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        PersonRoleId UNIQUEIDENTIFIER NOT NULL,
        ItemType NVARCHAR(32) NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        Direction NVARCHAR(64) NULL,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaReviewEvents_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaReviewEvents_Role FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaReviewEvents_Person_Item' AND object_id = OBJECT_ID('dbo.CogitaReviewEvents'))
BEGIN
    CREATE INDEX IX_CogitaReviewEvents_Person_Item ON dbo.CogitaReviewEvents(PersonRoleId, ItemType, ItemId, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaReviewOutcomes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaReviewOutcomes
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        PersonRoleId UNIQUEIDENTIFIER NOT NULL,
        ItemType NVARCHAR(32) NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        CheckType NVARCHAR(64) NOT NULL,
        Direction NVARCHAR(64) NULL,
        RevisionType NVARCHAR(64) NOT NULL,
        EvalType NVARCHAR(64) NOT NULL,
        Correct BIT NOT NULL,
        ClientId NVARCHAR(64) NOT NULL,
        ClientSequence BIGINT NOT NULL,
        PayloadHash VARBINARY(64) NULL,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaReviewOutcomes_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaReviewOutcomes_Role FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaReviewOutcomes_Person_Item' AND object_id = OBJECT_ID('dbo.CogitaReviewOutcomes'))
BEGIN
    CREATE INDEX IX_CogitaReviewOutcomes_Person_Item ON dbo.CogitaReviewOutcomes(PersonRoleId, ItemType, ItemId, CheckType, Direction, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaReviewOutcomes_Client' AND object_id = OBJECT_ID('dbo.CogitaReviewOutcomes'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaReviewOutcomes_Client ON dbo.CogitaReviewOutcomes(PersonRoleId, ClientId, ClientSequence);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaItemDependencies' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaItemDependencies
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ParentItemType NVARCHAR(32) NOT NULL,
        ParentItemId UNIQUEIDENTIFIER NOT NULL,
        ParentCheckType NVARCHAR(64) NULL,
        ParentDirection NVARCHAR(128) NULL,
        ChildItemType NVARCHAR(32) NOT NULL,
        ChildItemId UNIQUEIDENTIFIER NOT NULL,
        ChildCheckType NVARCHAR(64) NULL,
        ChildDirection NVARCHAR(128) NULL,
        LinkHash BINARY(32) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaItemDependencies_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ParentCheckType') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD ParentCheckType NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ParentDirection') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD ParentDirection NVARCHAR(128) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ChildCheckType') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD ChildCheckType NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ChildDirection') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD ChildDirection NVARCHAR(128) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'LinkHash') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD LinkHash BINARY(32) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ParentDirection') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CogitaItemDependencies') AND name = 'ParentDirection' AND max_length <> 128)
    BEGIN
        UPDATE dbo.CogitaItemDependencies
        SET ParentDirection = LEFT(ParentDirection, 64)
        WHERE ParentDirection IS NOT NULL AND LEN(ParentDirection) > 64;
        ALTER TABLE dbo.CogitaItemDependencies ALTER COLUMN ParentDirection NVARCHAR(64) NULL;
    END
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'ChildDirection') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CogitaItemDependencies') AND name = 'ChildDirection' AND max_length <> 128)
    BEGIN
        UPDATE dbo.CogitaItemDependencies
        SET ChildDirection = LEFT(ChildDirection, 64)
        WHERE ChildDirection IS NOT NULL AND LEN(ChildDirection) > 64;
        ALTER TABLE dbo.CogitaItemDependencies ALTER COLUMN ChildDirection NVARCHAR(64) NULL;
    END
END
GO

UPDATE dbo.CogitaItemDependencies
SET LinkHash = HASHBYTES(
    'SHA2_256',
    LOWER(CONCAT(
        CONVERT(NVARCHAR(36), LibraryId), '|',
        LTRIM(RTRIM(COALESCE(ParentItemType, ''))), '|',
        CONVERT(NVARCHAR(36), ParentItemId), '|',
        LTRIM(RTRIM(COALESCE(ParentCheckType, ''))), '|',
        LTRIM(RTRIM(COALESCE(ParentDirection, ''))), '|',
        LTRIM(RTRIM(COALESCE(ChildItemType, ''))), '|',
        CONVERT(NVARCHAR(36), ChildItemId), '|',
        LTRIM(RTRIM(COALESCE(ChildCheckType, ''))), '|',
        LTRIM(RTRIM(COALESCE(ChildDirection, '')))
    ))
)
WHERE LinkHash IS NULL;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.CogitaItemDependencies')
      AND name = 'LinkHash'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ALTER COLUMN LinkHash BINARY(32) NOT NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaItemDependencies_Link' AND object_id = OBJECT_ID('dbo.CogitaItemDependencies'))
BEGIN
    DROP INDEX UX_CogitaItemDependencies_Link ON dbo.CogitaItemDependencies;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaItemDependencies_Link' AND object_id = OBJECT_ID('dbo.CogitaItemDependencies'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaItemDependencies_Link
        ON dbo.CogitaItemDependencies(LibraryId, LinkHash);
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaItemDependencies_Child' AND object_id = OBJECT_ID('dbo.CogitaItemDependencies'))
BEGIN
    DROP INDEX IX_CogitaItemDependencies_Child ON dbo.CogitaItemDependencies;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaItemDependencies_Child' AND object_id = OBJECT_ID('dbo.CogitaItemDependencies'))
BEGIN
    CREATE INDEX IX_CogitaItemDependencies_Child
        ON dbo.CogitaItemDependencies(LibraryId, ChildItemType, ChildItemId, ChildCheckType, ChildDirection);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaRevisionShares' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaRevisionShares
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        CollectionId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        SharedViewId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        EncShareCode VARBINARY(MAX) NOT NULL,
        Mode NVARCHAR(32) NOT NULL,
        CheckMode NVARCHAR(32) NOT NULL,
        CardLimit INT NOT NULL,
        RevisionType NVARCHAR(64) NULL,
        RevisionSettingsJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CogitaRevisionShares_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaRevisionShares_Collection FOREIGN KEY (CollectionId) REFERENCES dbo.CogitaInfos(Id),
        CONSTRAINT FK_CogitaRevisionShares_SharedView FOREIGN KEY (SharedViewId) REFERENCES dbo.SharedViews(Id),
        CONSTRAINT FK_CogitaRevisionShares_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_Library_Revoked' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
BEGIN
    CREATE INDEX IX_CogitaRevisionShares_Library_Revoked ON dbo.CogitaRevisionShares(LibraryId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
BEGIN
    CREATE INDEX IX_CogitaRevisionShares_PublicCodeHash ON dbo.CogitaRevisionShares(PublicCodeHash);
END
GO
