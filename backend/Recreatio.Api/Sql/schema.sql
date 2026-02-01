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
IF OBJECT_ID(N'dbo.CogitaGroupConnections', N'U') IS NOT NULL DROP TABLE dbo.CogitaGroupConnections;
IF OBJECT_ID(N'dbo.CogitaGroupItems', N'U') IS NOT NULL DROP TABLE dbo.CogitaGroupItems;
IF OBJECT_ID(N'dbo.CogitaGroups', N'U') IS NOT NULL DROP TABLE dbo.CogitaGroups;
IF OBJECT_ID(N'dbo.CogitaConnectionItems', N'U') IS NOT NULL DROP TABLE dbo.CogitaConnectionItems;
IF OBJECT_ID(N'dbo.CogitaConnections', N'U') IS NOT NULL DROP TABLE dbo.CogitaConnections;
IF OBJECT_ID(N'dbo.CogitaMusicFragments', N'U') IS NOT NULL DROP TABLE dbo.CogitaMusicFragments;
IF OBJECT_ID(N'dbo.CogitaMusicPieces', N'U') IS NOT NULL DROP TABLE dbo.CogitaMusicPieces;
IF OBJECT_ID(N'dbo.CogitaGeoFeatures', N'U') IS NOT NULL DROP TABLE dbo.CogitaGeoFeatures;
IF OBJECT_ID(N'dbo.CogitaMedia', N'U') IS NOT NULL DROP TABLE dbo.CogitaMedia;
IF OBJECT_ID(N'dbo.CogitaBooks', N'U') IS NOT NULL DROP TABLE dbo.CogitaBooks;
IF OBJECT_ID(N'dbo.CogitaPhones', N'U') IS NOT NULL DROP TABLE dbo.CogitaPhones;
IF OBJECT_ID(N'dbo.CogitaEmails', N'U') IS NOT NULL DROP TABLE dbo.CogitaEmails;
IF OBJECT_ID(N'dbo.CogitaAddresses', N'U') IS NOT NULL DROP TABLE dbo.CogitaAddresses;
IF OBJECT_ID(N'dbo.CogitaPersons', N'U') IS NOT NULL DROP TABLE dbo.CogitaPersons;
IF OBJECT_ID(N'dbo.CogitaTopics', N'U') IS NOT NULL DROP TABLE dbo.CogitaTopics;
IF OBJECT_ID(N'dbo.CogitaSentences', N'U') IS NOT NULL DROP TABLE dbo.CogitaSentences;
IF OBJECT_ID(N'dbo.CogitaWords', N'U') IS NOT NULL DROP TABLE dbo.CogitaWords;
IF OBJECT_ID(N'dbo.CogitaWordLanguages', N'U') IS NOT NULL DROP TABLE dbo.CogitaWordLanguages;
IF OBJECT_ID(N'dbo.CogitaLanguages', N'U') IS NOT NULL DROP TABLE dbo.CogitaLanguages;
IF OBJECT_ID(N'dbo.CogitaInfos', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfos;
IF OBJECT_ID(N'dbo.CogitaComputedInfos', N'U') IS NOT NULL DROP TABLE dbo.CogitaComputedInfos;
IF OBJECT_ID(N'dbo.CogitaLibraries', N'U') IS NOT NULL DROP TABLE dbo.CogitaLibraries;
IF OBJECT_ID(N'dbo.CogitaInfoSearchIndexes', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfoSearchIndexes;
IF OBJECT_ID(N'dbo.CogitaReviewOutcomes', N'U') IS NOT NULL DROP TABLE dbo.CogitaReviewOutcomes;
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionShares;
IF OBJECT_ID(N'dbo.PendingDataShares', N'U') IS NOT NULL DROP TABLE dbo.PendingDataShares;
IF OBJECT_ID(N'dbo.DataKeyGrants', N'U') IS NOT NULL DROP TABLE dbo.DataKeyGrants;
IF OBJECT_ID(N'dbo.DataItems', N'U') IS NOT NULL DROP TABLE dbo.DataItems;
IF OBJECT_ID(N'dbo.SharedViews', N'U') IS NOT NULL DROP TABLE dbo.SharedViews;
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
    LabelNormalized NVARCHAR(512) NOT NULL,
    LabelHash VARBINARY(32) NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL
);
CREATE INDEX IX_CogitaInfoSearchIndexes_LibraryTypeLabel ON dbo.CogitaInfoSearchIndexes (LibraryId, InfoType, LabelNormalized);
CREATE UNIQUE INDEX IX_CogitaInfoSearchIndexes_LibraryInfo ON dbo.CogitaInfoSearchIndexes (LibraryId, InfoId);
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

CREATE TABLE dbo.CogitaBooks
(
    InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaBooks_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
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

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollectionGraphs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaCollectionGraphs_Collection' AND object_id = OBJECT_ID('dbo.CogitaCollectionGraphs'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaCollectionGraphs_Collection ON dbo.CogitaCollectionGraphs(CollectionInfoId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollectionGraphNodes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCollectionGraphNodes_Graph' AND object_id = OBJECT_ID('dbo.CogitaCollectionGraphNodes'))
BEGIN
    CREATE INDEX IX_CogitaCollectionGraphNodes_Graph ON dbo.CogitaCollectionGraphNodes(GraphId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCollectionGraphEdges' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCollectionGraphEdges_Graph' AND object_id = OBJECT_ID('dbo.CogitaCollectionGraphEdges'))
BEGIN
    CREATE INDEX IX_CogitaCollectionGraphEdges_Graph ON dbo.CogitaCollectionGraphEdges(GraphId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaDependencyGraphs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaDependencyGraphs_Library' AND object_id = OBJECT_ID('dbo.CogitaDependencyGraphs'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaDependencyGraphs_Library ON dbo.CogitaDependencyGraphs(LibraryId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaDependencyGraphNodes' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
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
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaDependencyGraphNodes_Graph' AND object_id = OBJECT_ID('dbo.CogitaDependencyGraphNodes'))
BEGIN
    CREATE INDEX IX_CogitaDependencyGraphNodes_Graph ON dbo.CogitaDependencyGraphNodes(GraphId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaDependencyGraphEdges' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaDependencyGraphEdges
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyGraphEdges PRIMARY KEY,
        GraphId UNIQUEIDENTIFIER NOT NULL,
        FromNodeId UNIQUEIDENTIFIER NOT NULL,
        ToNodeId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaDependencyGraphEdges_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaDependencyGraphs(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaDependencyGraphEdges_Graph' AND object_id = OBJECT_ID('dbo.CogitaDependencyGraphEdges'))
BEGIN
    CREATE INDEX IX_CogitaDependencyGraphEdges_Graph ON dbo.CogitaDependencyGraphEdges(GraphId);
END
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
    CREATE INDEX IX_CogitaReviewOutcomes_Person_Item ON dbo.CogitaReviewOutcomes(PersonRoleId, ItemType, ItemId, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaReviewOutcomes_Client' AND object_id = OBJECT_ID('dbo.CogitaReviewOutcomes'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaReviewOutcomes_Client ON dbo.CogitaReviewOutcomes(PersonRoleId, ClientId, ClientSequence);
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

CREATE TABLE dbo.CogitaGroups
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    GroupType NVARCHAR(96) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaGroups_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
);
GO

CREATE TABLE dbo.CogitaGroupItems
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    GroupId UNIQUEIDENTIFIER NOT NULL,
    InfoId UNIQUEIDENTIFIER NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT FK_CogitaGroupItems_Group FOREIGN KEY (GroupId) REFERENCES dbo.CogitaGroups(Id),
    CONSTRAINT FK_CogitaGroupItems_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaGroupItems_Link ON dbo.CogitaGroupItems(GroupId, InfoId);
GO

CREATE TABLE dbo.CogitaGroupConnections
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    GroupId UNIQUEIDENTIFIER NOT NULL,
    ConnectionId UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT FK_CogitaGroupConnections_Group FOREIGN KEY (GroupId) REFERENCES dbo.CogitaGroups(Id),
    CONSTRAINT FK_CogitaGroupConnections_Connection FOREIGN KEY (ConnectionId) REFERENCES dbo.CogitaConnections(Id)
);
GO

CREATE UNIQUE INDEX UX_CogitaGroupConnections_Link ON dbo.CogitaGroupConnections(GroupId, ConnectionId);
GO
