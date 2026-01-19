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
IF OBJECT_ID(N'dbo.RoleRecoveryPlanShares', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryPlanShares;
IF OBJECT_ID(N'dbo.RoleRecoveryPlans', N'U') IS NOT NULL DROP TABLE dbo.RoleRecoveryPlans;
IF OBJECT_ID(N'dbo.RoleFields', N'U') IS NOT NULL DROP TABLE dbo.RoleFields;
IF OBJECT_ID(N'dbo.PendingDataShares', N'U') IS NOT NULL DROP TABLE dbo.PendingDataShares;
IF OBJECT_ID(N'dbo.DataKeyGrants', N'U') IS NOT NULL DROP TABLE dbo.DataKeyGrants;
IF OBJECT_ID(N'dbo.DataItems', N'U') IS NOT NULL DROP TABLE dbo.DataItems;
IF OBJECT_ID(N'dbo.SharedViews', N'U') IS NOT NULL DROP TABLE dbo.SharedViews;
IF OBJECT_ID(N'dbo.Memberships', N'U') IS NOT NULL DROP TABLE dbo.Memberships;
IF OBJECT_ID(N'dbo.PendingRoleShares', N'U') IS NOT NULL DROP TABLE dbo.PendingRoleShares;
IF OBJECT_ID(N'dbo.RoleEdges', N'U') IS NOT NULL DROP TABLE dbo.RoleEdges;
IF OBJECT_ID(N'dbo.Sessions', N'U') IS NOT NULL DROP TABLE dbo.Sessions;
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
    MetadataJson NVARCHAR(256) NOT NULL,
    LedgerRefId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_Keys_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_Keys_Ledger FOREIGN KEY (LedgerRefId) REFERENCES dbo.KeyLedger(Id)
);
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
    RelationshipType NVARCHAR(64) NOT NULL,
    EncryptedReadKeyCopy VARBINARY(MAX) NOT NULL,
    EncryptedWriteKeyCopy VARBINARY(MAX) NULL,
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
    FieldType NVARCHAR(64) NOT NULL,
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedValue VARBINARY(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_RoleFields_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleFields_Key FOREIGN KEY (DataKeyId) REFERENCES dbo.Keys(Id)
);
GO

CREATE UNIQUE INDEX UX_RoleFields_Role_FieldType ON dbo.RoleFields(RoleId, FieldType);
GO

CREATE TABLE dbo.DataItems
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
    ItemType NVARCHAR(32) NOT NULL,
    ItemName NVARCHAR(128) NOT NULL,
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

CREATE TABLE dbo.RoleRecoveryPlans
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    TargetRoleId UNIQUEIDENTIFIER NOT NULL,
    CreatedByRoleId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    ActivatedUtc DATETIMEOFFSET NULL,
    CONSTRAINT FK_RoleRecoveryPlans_TargetRole FOREIGN KEY (TargetRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_RoleRecoveryPlans_CreatedByRole FOREIGN KEY (CreatedByRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_RoleRecoveryPlans_Target_Activated ON dbo.RoleRecoveryPlans(TargetRoleId, ActivatedUtc);
GO

CREATE TABLE dbo.RoleRecoveryPlanShares
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    PlanId UNIQUEIDENTIFIER NOT NULL,
    SharedWithRoleId UNIQUEIDENTIFIER NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_RoleRecoveryPlanShares_Plan FOREIGN KEY (PlanId) REFERENCES dbo.RoleRecoveryPlans(Id),
    CONSTRAINT FK_RoleRecoveryPlanShares_SharedWithRole FOREIGN KEY (SharedWithRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE UNIQUE INDEX UX_RoleRecoveryPlanShares_Plan_SharedWith ON dbo.RoleRecoveryPlanShares(PlanId, SharedWithRoleId);
GO

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
