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
IF OBJECT_ID(N'chat.ChatConversationReadStates', N'U') IS NOT NULL DROP TABLE chat.ChatConversationReadStates;
IF OBJECT_ID(N'chat.ChatPublicLinks', N'U') IS NOT NULL DROP TABLE chat.ChatPublicLinks;
IF OBJECT_ID(N'chat.ChatMessages', N'U') IS NOT NULL DROP TABLE chat.ChatMessages;
IF OBJECT_ID(N'chat.ChatConversationKeyVersions', N'U') IS NOT NULL DROP TABLE chat.ChatConversationKeyVersions;
IF OBJECT_ID(N'chat.ChatConversationParticipants', N'U') IS NOT NULL DROP TABLE chat.ChatConversationParticipants;
IF OBJECT_ID(N'chat.ChatConversations', N'U') IS NOT NULL DROP TABLE chat.ChatConversations;
IF OBJECT_ID(N'pilgrimage.PilgrimageContactInquiries', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageContactInquiries;
IF OBJECT_ID(N'pilgrimage.PilgrimageParticipantIssues', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageParticipantIssues;
IF OBJECT_ID(N'pilgrimage.PilgrimageTasks', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageTasks;
IF OBJECT_ID(N'pilgrimage.PilgrimageAnnouncements', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageAnnouncements;
IF OBJECT_ID(N'pilgrimage.PilgrimageParticipantAccessTokens', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageParticipantAccessTokens;
IF OBJECT_ID(N'pilgrimage.PilgrimageParticipants', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageParticipants;
IF OBJECT_ID(N'pilgrimage.PilgrimageSiteConfigs', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageSiteConfigs;
IF OBJECT_ID(N'pilgrimage.PilgrimageEvents', N'U') IS NOT NULL DROP TABLE pilgrimage.PilgrimageEvents;
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
IF OBJECT_ID(N'dbo.CogitaQuestions', N'U') IS NOT NULL DROP TABLE dbo.CogitaQuestions;
IF OBJECT_ID(N'dbo.CogitaLibraries', N'U') IS NOT NULL DROP TABLE dbo.CogitaLibraries;
IF OBJECT_ID(N'dbo.CogitaInfoSearchIndexes', N'U') IS NOT NULL DROP TABLE dbo.CogitaInfoSearchIndexes;
IF OBJECT_ID(N'dbo.CogitaEntitySearchDocuments', N'U') IS NOT NULL DROP TABLE dbo.CogitaEntitySearchDocuments;
IF OBJECT_ID(N'dbo.CogitaReviewOutcomes', N'U') IS NOT NULL DROP TABLE dbo.CogitaReviewOutcomes;
IF OBJECT_ID(N'dbo.CogitaStatisticEvents', N'U') IS NOT NULL DROP TABLE dbo.CogitaStatisticEvents;
IF OBJECT_ID(N'dbo.CogitaLiveRevisionAnswers', N'U') IS NOT NULL DROP TABLE dbo.CogitaLiveRevisionAnswers;
IF OBJECT_ID(N'dbo.CogitaLiveRevisionParticipants', N'U') IS NOT NULL DROP TABLE dbo.CogitaLiveRevisionParticipants;
IF OBJECT_ID(N'dbo.CogitaLiveRevisionReloginRequests', N'U') IS NOT NULL DROP TABLE dbo.CogitaLiveRevisionReloginRequests;
IF OBJECT_ID(N'dbo.CogitaLiveRevisionSessions', N'U') IS NOT NULL DROP TABLE dbo.CogitaLiveRevisionSessions;
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionShares;
IF OBJECT_ID(N'dbo.CogitaRevisions', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisions;
IF OBJECT_ID(N'dbo.CogitaCreationProjects', N'U') IS NOT NULL DROP TABLE dbo.CogitaCreationProjects;
IF OBJECT_ID(N'dbo.CogitaItemDependencies', N'U') IS NOT NULL DROP TABLE dbo.CogitaItemDependencies;
IF OBJECT_ID(N'dbo.PendingDataShares', N'U') IS NOT NULL DROP TABLE dbo.PendingDataShares;
IF OBJECT_ID(N'dbo.DataKeyGrants', N'U') IS NOT NULL DROP TABLE dbo.DataKeyGrants;
IF OBJECT_ID(N'dbo.DataItems', N'U') IS NOT NULL DROP TABLE dbo.DataItems;
IF OBJECT_ID(N'dbo.SharedViews', N'U') IS NOT NULL DROP TABLE dbo.SharedViews;
IF OBJECT_ID(N'dbo.ParishConfirmationPhoneVerifications', N'U') IS NOT NULL DROP TABLE dbo.ParishConfirmationPhoneVerifications;
IF OBJECT_ID(N'dbo.ParishConfirmationCandidates', N'U') IS NOT NULL DROP TABLE dbo.ParishConfirmationCandidates;
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

CREATE TABLE dbo.ParishConfirmationCandidates
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    PayloadEnc VARBINARY(MAX) NOT NULL,
    AcceptedRodo BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_ParishConfirmationCandidates_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
    CONSTRAINT CK_ParishConfirmationCandidates_AcceptedRodo CHECK (AcceptedRodo = 1)
);
GO

CREATE INDEX IX_ParishConfirmationCandidates_ParishCreated ON dbo.ParishConfirmationCandidates(ParishId, CreatedUtc);
GO

CREATE TABLE dbo.ParishConfirmationPhoneVerifications
(
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    ParishId UNIQUEIDENTIFIER NOT NULL,
    CandidateId UNIQUEIDENTIFIER NOT NULL,
    PhoneIndex INT NOT NULL,
    VerificationToken NVARCHAR(128) NOT NULL,
    VerifiedUtc DATETIMEOFFSET NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_ParishConfirmationPhoneVerifications_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
    CONSTRAINT FK_ParishConfirmationPhoneVerifications_Candidate FOREIGN KEY (CandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
    CONSTRAINT CK_ParishConfirmationPhoneVerifications_PhoneIndex CHECK (PhoneIndex >= 0 AND PhoneIndex < 6)
);
GO

CREATE UNIQUE INDEX UX_ParishConfirmationPhoneVerifications_Token ON dbo.ParishConfirmationPhoneVerifications(VerificationToken);
GO

CREATE UNIQUE INDEX UX_ParishConfirmationPhoneVerifications_CandidatePhone ON dbo.ParishConfirmationPhoneVerifications(CandidateId, PhoneIndex);
GO

CREATE INDEX IX_ParishConfirmationPhoneVerifications_ParishCandidate
    ON dbo.ParishConfirmationPhoneVerifications(ParishId, CandidateId);
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

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaQuestions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaQuestions
    (
        InfoId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaQuestions_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

INSERT INTO dbo.CogitaQuestions (InfoId, DataKeyId, EncryptedBlob, CreatedUtc, UpdatedUtc)
SELECT ci.InfoId, ci.DataKeyId, ci.EncryptedBlob, ci.CreatedUtc, ci.UpdatedUtc
FROM dbo.CogitaComputedInfos ci
JOIN dbo.CogitaInfos i ON i.Id = ci.InfoId
LEFT JOIN dbo.CogitaQuestions q ON q.InfoId = ci.InfoId
WHERE i.InfoType = 'question'
  AND q.InfoId IS NULL;
GO

DELETE ci
FROM dbo.CogitaComputedInfos ci
JOIN dbo.CogitaInfos i ON i.Id = ci.InfoId
WHERE i.InfoType = 'question';
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
    Name NVARCHAR(200) NOT NULL CONSTRAINT DF_CogitaDependencyGraphs_Name DEFAULT (N'Dependency graph'),
    IsActive BIT NOT NULL CONSTRAINT DF_CogitaDependencyGraphs_IsActive DEFAULT (0),
    DataKeyId UNIQUEIDENTIFIER NOT NULL,
    EncryptedBlob VARBINARY(8000) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyGraphs_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
);
GO

IF COL_LENGTH('dbo.CogitaDependencyGraphs', 'Name') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaDependencyGraphs ADD Name NVARCHAR(200) NOT NULL CONSTRAINT DF_CogitaDependencyGraphs_Name_Migrate DEFAULT (N'Dependency graph');
END
GO

IF COL_LENGTH('dbo.CogitaDependencyGraphs', 'IsActive') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaDependencyGraphs ADD IsActive BIT NOT NULL CONSTRAINT DF_CogitaDependencyGraphs_IsActive_Migrate DEFAULT (0);
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaDependencyGraphs_Library' AND object_id = OBJECT_ID('dbo.CogitaDependencyGraphs'))
BEGIN
    DROP INDEX UX_CogitaDependencyGraphs_Library ON dbo.CogitaDependencyGraphs;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaDependencyGraphs_Library' AND object_id = OBJECT_ID('dbo.CogitaDependencyGraphs'))
BEGIN
    CREATE INDEX IX_CogitaDependencyGraphs_Library ON dbo.CogitaDependencyGraphs(LibraryId, IsActive, UpdatedUtc DESC);
END
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
        DurationMs INT NULL,
        PayloadHash VARBINARY(64) NULL,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaReviewOutcomes_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaReviewOutcomes_Role FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaReviewOutcomes', 'DurationMs') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaReviewOutcomes ADD DurationMs INT NULL;
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

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaStatisticEvents' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaStatisticEvents
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ScopeType NVARCHAR(32) NOT NULL,
        ScopeId UNIQUEIDENTIFIER NULL,
        SourceType NVARCHAR(32) NOT NULL,
        SessionId UNIQUEIDENTIFIER NULL,
        PersonRoleId UNIQUEIDENTIFIER NULL,
        ParticipantId UNIQUEIDENTIFIER NULL,
        ParticipantLabel NVARCHAR(120) NULL,
        ItemType NVARCHAR(32) NULL,
        ItemId UNIQUEIDENTIFIER NULL,
        CheckType NVARCHAR(64) NULL,
        Direction NVARCHAR(64) NULL,
        EventType NVARCHAR(64) NOT NULL,
        RoundIndex INT NULL,
        CardKey NVARCHAR(256) NULL,
        IsCorrect BIT NULL,
        Correctness FLOAT NULL,
        PointsAwarded INT NULL,
        DurationMs INT NULL,
        IsPersistent BIT NOT NULL CONSTRAINT DF_CogitaStatisticEvents_IsPersistent DEFAULT (0),
        PayloadJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaStatisticEvents_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStatisticEvents_ScopeTime' AND object_id = OBJECT_ID('dbo.CogitaStatisticEvents'))
BEGIN
    CREATE INDEX IX_CogitaStatisticEvents_ScopeTime ON dbo.CogitaStatisticEvents(LibraryId, ScopeType, ScopeId, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStatisticEvents_PersonTime' AND object_id = OBJECT_ID('dbo.CogitaStatisticEvents'))
BEGIN
    CREATE INDEX IX_CogitaStatisticEvents_PersonTime ON dbo.CogitaStatisticEvents(PersonRoleId, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStatisticEvents_ParticipantTime' AND object_id = OBJECT_ID('dbo.CogitaStatisticEvents'))
BEGIN
    CREATE INDEX IX_CogitaStatisticEvents_ParticipantTime ON dbo.CogitaStatisticEvents(ParticipantId, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStatisticEvents_SessionRound' AND object_id = OBJECT_ID('dbo.CogitaStatisticEvents'))
BEGIN
    CREATE INDEX IX_CogitaStatisticEvents_SessionRound ON dbo.CogitaStatisticEvents(SessionId, RoundIndex, CreatedUtc DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaItemDependencies' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaItemDependencies
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        GraphId UNIQUEIDENTIFIER NULL,
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
        CONSTRAINT FK_CogitaItemDependencies_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaItemDependencies_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaDependencyGraphs(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaItemDependencies', 'GraphId') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies ADD GraphId UNIQUEIDENTIFIER NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_CogitaItemDependencies_Graph'
      AND parent_object_id = OBJECT_ID('dbo.CogitaItemDependencies')
)
BEGIN
    ALTER TABLE dbo.CogitaItemDependencies
    ADD CONSTRAINT FK_CogitaItemDependencies_Graph FOREIGN KEY (GraphId) REFERENCES dbo.CogitaDependencyGraphs(Id);
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
        ON dbo.CogitaItemDependencies(LibraryId, GraphId, LinkHash);
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
        ON dbo.CogitaItemDependencies(LibraryId, GraphId, ChildItemType, ChildItemId, ChildCheckType, ChildDirection);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaRevisions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaRevisions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        CollectionId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        RevisionType NVARCHAR(64) NOT NULL,
        RevisionSettingsJson NVARCHAR(MAX) NULL,
        Mode NVARCHAR(32) NOT NULL CONSTRAINT DF_CogitaRevisions_Mode DEFAULT (N'random'),
        CheckMode NVARCHAR(32) NOT NULL CONSTRAINT DF_CogitaRevisions_CheckMode DEFAULT (N'exact'),
        CardLimit INT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaRevisions_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaRevisions_Collection FOREIGN KEY (CollectionId) REFERENCES dbo.CogitaInfos(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisions_LibraryCollectionCreated' AND object_id = OBJECT_ID('dbo.CogitaRevisions'))
BEGIN
    CREATE INDEX IX_CogitaRevisions_LibraryCollectionCreated ON dbo.CogitaRevisions(LibraryId, CollectionId, CreatedUtc, Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisions_CollectionName' AND object_id = OBJECT_ID('dbo.CogitaRevisions'))
BEGIN
    CREATE INDEX IX_CogitaRevisions_CollectionName ON dbo.CogitaRevisions(CollectionId, Name);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaCreationProjects' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaCreationProjects
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ProjectType NVARCHAR(32) NOT NULL,
        Name NVARCHAR(256) NOT NULL,
        ContentJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaCreationProjects_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCreationProjects_LibraryTypeUpdated' AND object_id = OBJECT_ID('dbo.CogitaCreationProjects'))
BEGIN
    CREATE INDEX IX_CogitaCreationProjects_LibraryTypeUpdated
        ON dbo.CogitaCreationProjects(LibraryId, ProjectType, UpdatedUtc DESC, Id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaCreationProjects_LibraryTypeName' AND object_id = OBJECT_ID('dbo.CogitaCreationProjects'))
BEGIN
    CREATE INDEX IX_CogitaCreationProjects_LibraryTypeName
        ON dbo.CogitaCreationProjects(LibraryId, ProjectType, Name);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaStoryboardShares' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaStoryboardShares
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ProjectId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        EncShareCode VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CogitaStoryboardShares_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaStoryboardShares_Project FOREIGN KEY (ProjectId) REFERENCES dbo.CogitaCreationProjects(Id),
        CONSTRAINT FK_CogitaStoryboardShares_OwnerRole FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_Library_Revoked' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
BEGIN
    CREATE INDEX IX_CogitaStoryboardShares_Library_Revoked
        ON dbo.CogitaStoryboardShares(LibraryId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_Library_Project_Revoked' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
BEGIN
    CREATE INDEX IX_CogitaStoryboardShares_Library_Project_Revoked
        ON dbo.CogitaStoryboardShares(LibraryId, ProjectId, RevokedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaStoryboardShares_ActiveProject' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaStoryboardShares_ActiveProject
        ON dbo.CogitaStoryboardShares(ProjectId)
        WHERE RevokedUtc IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
BEGIN
    CREATE INDEX IX_CogitaStoryboardShares_PublicCodeHash
        ON dbo.CogitaStoryboardShares(PublicCodeHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaRevisionShares' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaRevisionShares
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        RevisionId UNIQUEIDENTIFIER NOT NULL,
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
        CONSTRAINT FK_CogitaRevisionShares_Revision FOREIGN KEY (RevisionId) REFERENCES dbo.CogitaRevisions(Id),
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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_Library_Revision_Revoked' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
BEGIN
    CREATE INDEX IX_CogitaRevisionShares_Library_Revision_Revoked ON dbo.CogitaRevisionShares(LibraryId, RevisionId, RevokedUtc);
END
GO

;WITH ActiveShares AS (
    SELECT
        Id,
        RevisionId,
        ROW_NUMBER() OVER (PARTITION BY RevisionId ORDER BY CreatedUtc DESC, Id DESC) AS rn
    FROM dbo.CogitaRevisionShares
    WHERE RevokedUtc IS NULL
)
UPDATE s
SET RevokedUtc = COALESCE(s.RevokedUtc, SWITCHOFFSET(SYSDATETIMEOFFSET(), '+00:00'))
FROM dbo.CogitaRevisionShares s
INNER JOIN ActiveShares a ON a.Id = s.Id
WHERE a.rn > 1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaRevisionShares_ActiveRevision' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaRevisionShares_ActiveRevision
        ON dbo.CogitaRevisionShares(RevisionId)
        WHERE RevokedUtc IS NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
BEGIN
    CREATE INDEX IX_CogitaRevisionShares_PublicCodeHash ON dbo.CogitaRevisionShares(PublicCodeHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaLiveRevisionSessions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaLiveRevisionSessions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        RevisionId UNIQUEIDENTIFIER NOT NULL,
        CollectionId UNIQUEIDENTIFIER NOT NULL,
        HostRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        HostSecretHash VARBINARY(64) NOT NULL,
        Status NVARCHAR(24) NOT NULL,
        CurrentRoundIndex INT NOT NULL,
        RevealVersion INT NOT NULL,
        CurrentPromptJson NVARCHAR(MAX) NULL,
        CurrentRevealJson NVARCHAR(MAX) NULL,
        SessionMetaJson NVARCHAR(MAX) NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        StartedUtc DATETIMEOFFSET NULL,
        FinishedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CogitaLiveRevisionSessions_Library FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        CONSTRAINT FK_CogitaLiveRevisionSessions_Revision FOREIGN KEY (RevisionId) REFERENCES dbo.CogitaRevisions(Id),
        CONSTRAINT FK_CogitaLiveRevisionSessions_Collection FOREIGN KEY (CollectionId) REFERENCES dbo.CogitaInfos(Id),
        CONSTRAINT FK_CogitaLiveRevisionSessions_HostRole FOREIGN KEY (HostRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionSessions_LibraryRevision' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionSessions'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionSessions_LibraryRevision ON dbo.CogitaLiveRevisionSessions(LibraryId, RevisionId);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaLiveRevisionSessions_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionSessions'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaLiveRevisionSessions_PublicCodeHash ON dbo.CogitaLiveRevisionSessions(PublicCodeHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaLiveRevisionParticipants' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaLiveRevisionParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        DisplayName NVARCHAR(120) NOT NULL,
        DisplayNameHash VARBINARY(64) NULL,
        DisplayNameCipher NVARCHAR(MAX) NULL,
        UserId UNIQUEIDENTIFIER NULL,
        JoinTokenHash VARBINARY(64) NOT NULL,
        Score INT NOT NULL CONSTRAINT DF_CogitaLiveRevisionParticipants_Score DEFAULT (0),
        IsConnected BIT NOT NULL CONSTRAINT DF_CogitaLiveRevisionParticipants_IsConnected DEFAULT (1),
        JoinedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaLiveRevisionParticipants_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaLiveRevisionSessions(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'DisplayNameHash') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaLiveRevisionParticipants ADD DisplayNameHash VARBINARY(64) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'DisplayNameCipher') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaLiveRevisionParticipants ADD DisplayNameCipher NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionParticipants_SessionName' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionParticipants'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionParticipants_SessionName ON dbo.CogitaLiveRevisionParticipants(SessionId, DisplayName);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionParticipants_SessionNameHash' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionParticipants'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionParticipants_SessionNameHash ON dbo.CogitaLiveRevisionParticipants(SessionId, DisplayNameHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaLiveRevisionParticipants_JoinTokenHash' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionParticipants'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaLiveRevisionParticipants_JoinTokenHash ON dbo.CogitaLiveRevisionParticipants(JoinTokenHash);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaLiveRevisionAnswers' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaLiveRevisionAnswers
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        ParticipantId UNIQUEIDENTIFIER NOT NULL,
        RoundIndex INT NOT NULL,
        CardKey NVARCHAR(256) NULL,
        AnswerJson NVARCHAR(MAX) NULL,
        IsCorrect BIT NULL,
        SubmittedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaLiveRevisionAnswers_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaLiveRevisionSessions(Id),
        CONSTRAINT FK_CogitaLiveRevisionAnswers_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaLiveRevisionParticipants(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionAnswers_SessionRound' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionAnswers'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionAnswers_SessionRound ON dbo.CogitaLiveRevisionAnswers(SessionId, RoundIndex);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaLiveRevisionAnswers_SessionParticipantRound' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionAnswers'))
BEGIN
    CREATE UNIQUE INDEX UX_CogitaLiveRevisionAnswers_SessionParticipantRound ON dbo.CogitaLiveRevisionAnswers(SessionId, ParticipantId, RoundIndex);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaLiveRevisionReloginRequests' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaLiveRevisionReloginRequests
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SessionId UNIQUEIDENTIFIER NOT NULL,
        DisplayName NVARCHAR(120) NOT NULL,
        DisplayNameHash VARBINARY(64) NULL,
        DisplayNameCipher NVARCHAR(MAX) NULL,
        Status NVARCHAR(24) NOT NULL CONSTRAINT DF_CogitaLiveRevisionReloginRequests_Status DEFAULT (N'pending'),
        RequestedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        ApprovedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_CogitaLiveRevisionReloginRequests_Session FOREIGN KEY (SessionId) REFERENCES dbo.CogitaLiveRevisionSessions(Id)
    );
END
GO

IF COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'DisplayNameHash') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaLiveRevisionReloginRequests ADD DisplayNameHash VARBINARY(64) NULL;
END
GO

IF COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'DisplayNameCipher') IS NULL
BEGIN
    ALTER TABLE dbo.CogitaLiveRevisionReloginRequests ADD DisplayNameCipher NVARCHAR(MAX) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionReloginRequests_SessionNameStatus' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionReloginRequests_SessionNameStatus ON dbo.CogitaLiveRevisionReloginRequests(SessionId, DisplayName, Status);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaLiveRevisionReloginRequests_SessionNameHashStatus' AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests'))
BEGIN
    CREATE INDEX IX_CogitaLiveRevisionReloginRequests_SessionNameHashStatus ON dbo.CogitaLiveRevisionReloginRequests(SessionId, DisplayNameHash, Status);
END
GO

IF OBJECT_ID(N'dbo.CogitaStatisticEvents', N'U') IS NOT NULL
    AND OBJECT_ID(N'dbo.CogitaLiveRevisionParticipants', N'U') IS NOT NULL
BEGIN
    UPDATE se
    SET se.SessionId = p.SessionId
    FROM dbo.CogitaStatisticEvents se
    INNER JOIN dbo.CogitaLiveRevisionParticipants p ON p.Id = se.ParticipantId
    WHERE se.SourceType = N'live-session-person'
      AND se.SessionId IS NULL;
END
GO

/*
  -----------------------------------------------------------------
  Integrated module schemas
  (previously maintained as standalone patch scripts)
  -----------------------------------------------------------------
*/
/*
  Cogita rebuild schema (no compatibility layer)
  Canonical base for knowledge, checkcards, runs, answers, knowness snapshots, and statistics.
*/

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.CogitaRunEvents', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunEvents;
IF OBJECT_ID(N'dbo.CogitaKnownessSnapshots', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnownessSnapshots;
IF OBJECT_ID(N'dbo.CogitaRunExposures', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunExposures;
IF OBJECT_ID(N'dbo.CogitaRunAttempts', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunAttempts;
IF OBJECT_ID(N'dbo.CogitaRunParticipants', N'U') IS NOT NULL DROP TABLE dbo.CogitaRunParticipants;
IF OBJECT_ID(N'dbo.CogitaRevisionRuns', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionRuns;
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionShares;
IF OBJECT_ID(N'dbo.CogitaRevisionPatterns', N'U') IS NOT NULL DROP TABLE dbo.CogitaRevisionPatterns;
IF OBJECT_ID(N'dbo.CogitaReferenceCryptoFields', N'U') IS NOT NULL DROP TABLE dbo.CogitaReferenceCryptoFields;
IF OBJECT_ID(N'dbo.CogitaCreationArtifacts', N'U') IS NOT NULL DROP TABLE dbo.CogitaCreationArtifacts;
IF OBJECT_ID(N'dbo.CogitaCreationProjects', N'U') IS NOT NULL DROP TABLE dbo.CogitaCreationProjects;
IF OBJECT_ID(N'dbo.CogitaDependencyEdges', N'U') IS NOT NULL DROP TABLE dbo.CogitaDependencyEdges;
IF OBJECT_ID(N'dbo.CogitaCheckcardDefinitions', N'U') IS NOT NULL DROP TABLE dbo.CogitaCheckcardDefinitions;
IF OBJECT_ID(N'dbo.CogitaKnowledgeLinkMultis', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeLinkMultis;
IF OBJECT_ID(N'dbo.CogitaKnowledgeLinkSingles', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeLinkSingles;
IF OBJECT_ID(N'dbo.CogitaKnowledgeItems', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeItems;
IF OBJECT_ID(N'dbo.CogitaKnowledgeTypeSpecs', N'U') IS NOT NULL DROP TABLE dbo.CogitaKnowledgeTypeSpecs;
GO

CREATE TABLE dbo.CogitaKnowledgeTypeSpecs
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeTypeSpecs PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    TypeKey NVARCHAR(96) NOT NULL,
    Version INT NOT NULL,
    DisplayName NVARCHAR(256) NOT NULL,
    SpecJson NVARCHAR(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT UX_CogitaKnowledgeTypeSpecs_LibraryTypeVersion UNIQUE (LibraryId, TypeKey, Version)
);
GO

CREATE TABLE dbo.CogitaKnowledgeItems
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeItems PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    TypeSpecId UNIQUEIDENTIFIER NOT NULL,
    TypeKey NVARCHAR(96) NOT NULL,
    Title NVARCHAR(512) NOT NULL,
    SearchText NVARCHAR(MAX) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    IsExcludedFromKnowness BIT NOT NULL CONSTRAINT DF_CogitaKnowledgeItems_IsExcludedFromKnowness DEFAULT (0),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeItems_TypeSpec FOREIGN KEY (TypeSpecId) REFERENCES dbo.CogitaKnowledgeTypeSpecs(Id),
    CONSTRAINT FK_CogitaKnowledgeItems_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaKnowledgeItems_Library ON dbo.CogitaKnowledgeItems (LibraryId, UpdatedUtc DESC);
CREATE INDEX IX_CogitaKnowledgeItems_Type ON dbo.CogitaKnowledgeItems (LibraryId, TypeKey, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaCreationProjects
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCreationProjects PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    ProjectType NVARCHAR(32) NOT NULL,
    Name NVARCHAR(256) NOT NULL,
    ContentJson NVARCHAR(MAX) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL
);
GO

CREATE INDEX IX_CogitaCreationProjects_LibraryTypeUpdated ON dbo.CogitaCreationProjects (LibraryId, ProjectType, UpdatedUtc DESC, Id);
CREATE INDEX IX_CogitaCreationProjects_LibraryTypeName ON dbo.CogitaCreationProjects (LibraryId, ProjectType, Name);
GO

CREATE TABLE dbo.CogitaCreationArtifacts
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCreationArtifacts PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    ProjectId UNIQUEIDENTIFIER NOT NULL,
    ArtifactType NVARCHAR(48) NOT NULL,
    Name NVARCHAR(256) NOT NULL,
    ContentJson NVARCHAR(MAX) NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NULL,
    SourceCardKey NVARCHAR(256) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCreationArtifacts_Project FOREIGN KEY (ProjectId) REFERENCES dbo.CogitaCreationProjects(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaCreationArtifacts_SourceItem FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id)
);
GO

CREATE INDEX IX_CogitaCreationArtifacts_ProjectUpdated ON dbo.CogitaCreationArtifacts (LibraryId, ProjectId, UpdatedUtc DESC);
CREATE INDEX IX_CogitaCreationArtifacts_SourceItemUpdated ON dbo.CogitaCreationArtifacts (LibraryId, SourceItemId, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaReferenceCryptoFields
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaReferenceCryptoFields PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    OwnerEntity NVARCHAR(96) NOT NULL,
    OwnerId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(96) NOT NULL,
    PolicyVersion NVARCHAR(64) NOT NULL,
    ValueCipher NVARCHAR(2048) NOT NULL,
    DeterministicHash VARBINARY(64) NOT NULL,
    SignatureBase64 NVARCHAR(1024) NULL,
    Signer NVARCHAR(128) NULL,
    SignatureVersion NVARCHAR(64) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT UX_CogitaReferenceCryptoFields_OwnerField UNIQUE (LibraryId, OwnerEntity, OwnerId, FieldKey)
);
GO

CREATE INDEX IX_CogitaReferenceCryptoFields_FieldHash ON dbo.CogitaReferenceCryptoFields (LibraryId, FieldKey, DeterministicHash);
GO

CREATE TABLE dbo.CogitaKnowledgeLinkSingles
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeLinkSingles PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetItemId UNIQUEIDENTIFIER NOT NULL,
    IsRequired BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeLinkSingles_Source FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaKnowledgeLinkSingles_Target FOREIGN KEY (TargetItemId) REFERENCES dbo.CogitaKnowledgeItems(Id),
    CONSTRAINT UX_CogitaKnowledgeLinkSingles_SourceField UNIQUE (SourceItemId, FieldKey)
);
GO

CREATE TABLE dbo.CogitaKnowledgeLinkMultis
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnowledgeLinkMultis PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    FieldKey NVARCHAR(64) NOT NULL,
    TargetItemId UNIQUEIDENTIFIER NOT NULL,
    SortOrder INT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnowledgeLinkMultis_Source FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaKnowledgeLinkMultis_Target FOREIGN KEY (TargetItemId) REFERENCES dbo.CogitaKnowledgeItems(Id),
    CONSTRAINT UX_CogitaKnowledgeLinkMultis_SourceFieldTarget UNIQUE (SourceItemId, FieldKey, TargetItemId)
);
GO

CREATE INDEX IX_CogitaKnowledgeLinkMultis_SourceFieldOrder ON dbo.CogitaKnowledgeLinkMultis (SourceItemId, FieldKey, SortOrder);
GO

CREATE TABLE dbo.CogitaCheckcardDefinitions
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaCheckcardDefinitions PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    SourceItemId UNIQUEIDENTIFIER NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    CardType NVARCHAR(64) NOT NULL,
    Direction INT NOT NULL,
    PromptJson NVARCHAR(MAX) NOT NULL,
    RevealJson NVARCHAR(MAX) NOT NULL,
    IsActive BIT NOT NULL CONSTRAINT DF_CogitaCheckcardDefinitions_IsActive DEFAULT (1),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaCheckcardDefinitions_Item FOREIGN KEY (SourceItemId) REFERENCES dbo.CogitaKnowledgeItems(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaCheckcardDefinitions_CardKey UNIQUE (LibraryId, CardKey)
);
GO

CREATE INDEX IX_CogitaCheckcardDefinitions_Item ON dbo.CogitaCheckcardDefinitions (SourceItemId, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaDependencyEdges
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDependencyEdges PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    ParentCardId UNIQUEIDENTIFIER NOT NULL,
    ChildCardId UNIQUEIDENTIFIER NOT NULL,
    ParentKnownessWeightPct DECIMAL(9,4) NOT NULL,
    ThresholdPct DECIMAL(9,4) NOT NULL,
    IsHardBlock BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaDependencyEdges_ParentCard FOREIGN KEY (ParentCardId) REFERENCES dbo.CogitaCheckcardDefinitions(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaDependencyEdges_ChildCard FOREIGN KEY (ChildCardId) REFERENCES dbo.CogitaCheckcardDefinitions(Id),
    CONSTRAINT UX_CogitaDependencyEdges_Link UNIQUE (ParentCardId, ChildCardId)
);
GO

CREATE INDEX IX_CogitaDependencyEdges_Child ON dbo.CogitaDependencyEdges (ChildCardId, ParentCardId);
GO

CREATE TABLE dbo.CogitaRevisionPatterns
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionPatterns PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RoleId UNIQUEIDENTIFIER NOT NULL,
    Name NVARCHAR(256) NOT NULL,
    Mode NVARCHAR(32) NOT NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    CollectionScopeJson NVARCHAR(MAX) NOT NULL,
    IsArchived BIT NOT NULL CONSTRAINT DF_CogitaRevisionPatterns_IsArchived DEFAULT (0),
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionPatterns_Role FOREIGN KEY (RoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaRevisionPatterns_Library ON dbo.CogitaRevisionPatterns (LibraryId, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRevisionShares
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionShares PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RevisionPatternId UNIQUEIDENTIFIER NOT NULL,
    ShareCodeHash VARBINARY(32) NOT NULL,
    ShareCodeCipher NVARCHAR(512) NOT NULL,
    IsEnabled BIT NOT NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionShares_Pattern FOREIGN KEY (RevisionPatternId) REFERENCES dbo.CogitaRevisionPatterns(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaRevisionShares_Pattern UNIQUE (RevisionPatternId),
    CONSTRAINT UX_CogitaRevisionShares_CodeHash UNIQUE (ShareCodeHash)
);
GO

CREATE TABLE dbo.CogitaRevisionRuns
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRevisionRuns PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RevisionPatternId UNIQUEIDENTIFIER NOT NULL,
    RunScope NVARCHAR(32) NOT NULL, /* solo|shared|group_sync|group_async */
    Title NVARCHAR(256) NULL,
    Status NVARCHAR(32) NOT NULL,
    SessionCodeHash VARBINARY(32) NULL,
    SessionCodeCipher NVARCHAR(512) NULL,
    SettingsJson NVARCHAR(MAX) NOT NULL,
    PromptBundleJson NVARCHAR(MAX) NULL,
    StartedUtc DATETIMEOFFSET NULL,
    FinishedUtc DATETIMEOFFSET NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRevisionRuns_Pattern FOREIGN KEY (RevisionPatternId) REFERENCES dbo.CogitaRevisionPatterns(Id) ON DELETE CASCADE,
    CONSTRAINT UX_CogitaRevisionRuns_CodeHash UNIQUE (SessionCodeHash)
);
GO

CREATE INDEX IX_CogitaRevisionRuns_LibraryStatus ON dbo.CogitaRevisionRuns (LibraryId, Status, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRunParticipants
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunParticipants PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    PersonRoleId UNIQUEIDENTIFIER NULL,
    DisplayNameCipher NVARCHAR(512) NOT NULL,
    AccessTokenHash VARBINARY(32) NULL,
    AccessTokenCipher NVARCHAR(512) NULL,
    IsHost BIT NOT NULL,
    IsConnected BIT NOT NULL,
    JoinedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunParticipants_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunParticipants_PersonRole FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id)
);
GO

CREATE INDEX IX_CogitaRunParticipants_Run ON dbo.CogitaRunParticipants (RunId, JoinedUtc);
CREATE INDEX IX_CogitaRunParticipants_RunRole ON dbo.CogitaRunParticipants (RunId, PersonRoleId);
GO

CREATE TABLE dbo.CogitaRunAttempts
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunAttempts PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    RoundIndex INT NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    AnswerCipher NVARCHAR(MAX) NULL,
    OutcomeClass NVARCHAR(32) NOT NULL,
    IsAnswered BIT NOT NULL,
    IsCorrect BIT NULL,
    CorrectnessPct DECIMAL(9,4) NULL,
    SubmittedUtc DATETIMEOFFSET NOT NULL,
    RevealedUtc DATETIMEOFFSET NULL,
    ResponseDurationMs INT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    UpdatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunAttempts_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunAttempts_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaRunAttempts_RunParticipantRound ON dbo.CogitaRunAttempts (RunId, ParticipantId, RoundIndex, UpdatedUtc DESC);
CREATE INDEX IX_CogitaRunAttempts_RunCard ON dbo.CogitaRunAttempts (RunId, CardKey, UpdatedUtc DESC);
GO

CREATE TABLE dbo.CogitaRunExposures
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunExposures PRIMARY KEY,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NOT NULL,
    RoundIndex INT NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    PromptShownUtc DATETIMEOFFSET NOT NULL,
    RevealShownUtc DATETIMEOFFSET NULL,
    WasSkipped BIT NOT NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunExposures_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunExposures_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaRunExposures_RunParticipant ON dbo.CogitaRunExposures (RunId, ParticipantId, RoundIndex);
GO

CREATE TABLE dbo.CogitaKnownessSnapshots
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaKnownessSnapshots PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    PersonRoleId UNIQUEIDENTIFIER NOT NULL,
    CardKey NVARCHAR(256) NOT NULL,
    SnapshotUtc DATETIMEOFFSET NOT NULL,
    KnownessPct DECIMAL(9,4) NOT NULL,
    CorrectCount INT NOT NULL,
    WrongCount INT NOT NULL,
    UnansweredCount INT NOT NULL,
    LastSeenUtc DATETIMEOFFSET NULL,
    SourceRunId UNIQUEIDENTIFIER NULL,
    SourceParticipantId UNIQUEIDENTIFIER NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaKnownessSnapshots_PersonRole FOREIGN KEY (PersonRoleId) REFERENCES dbo.Roles(Id),
    CONSTRAINT FK_CogitaKnownessSnapshots_Run FOREIGN KEY (SourceRunId) REFERENCES dbo.CogitaRevisionRuns(Id),
    CONSTRAINT FK_CogitaKnownessSnapshots_RunParticipant FOREIGN KEY (SourceParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaKnownessSnapshots_LibraryPersonCardUtc ON dbo.CogitaKnownessSnapshots (LibraryId, PersonRoleId, CardKey, SnapshotUtc DESC);
GO

CREATE TABLE dbo.CogitaRunEvents
(
    Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaRunEvents PRIMARY KEY,
    LibraryId UNIQUEIDENTIFIER NOT NULL,
    RunId UNIQUEIDENTIFIER NOT NULL,
    ParticipantId UNIQUEIDENTIFIER NULL,
    EventType NVARCHAR(64) NOT NULL,
    RoundIndex INT NULL,
    PayloadJson NVARCHAR(MAX) NULL,
    CreatedUtc DATETIMEOFFSET NOT NULL,
    CONSTRAINT FK_CogitaRunEvents_Run FOREIGN KEY (RunId) REFERENCES dbo.CogitaRevisionRuns(Id) ON DELETE CASCADE,
    CONSTRAINT FK_CogitaRunEvents_Participant FOREIGN KEY (ParticipantId) REFERENCES dbo.CogitaRunParticipants(Id)
);
GO

CREATE INDEX IX_CogitaRunEvents_RunCreated ON dbo.CogitaRunEvents (RunId, CreatedUtc);
CREATE INDEX IX_CogitaRunEvents_ParticipantCreated ON dbo.CogitaRunEvents (ParticipantId, CreatedUtc);
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CogitaDashboardPreferences' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CogitaDashboardPreferences
    (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaDashboardPreferences PRIMARY KEY,
        UserId UNIQUEIDENTIFIER NOT NULL,
        LayoutVersion NVARCHAR(64) NOT NULL CONSTRAINT DF_CogitaDashboardPreferences_LayoutVersion DEFAULT (N'v1'),
        PreferencesJson NVARCHAR(MAX) NOT NULL CONSTRAINT DF_CogitaDashboardPreferences_PreferencesJson DEFAULT (N'{}'),
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaDashboardPreferences_User FOREIGN KEY (UserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT UX_CogitaDashboardPreferences_User UNIQUE (UserId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaDashboardPreferences_UpdatedUtc' AND object_id = OBJECT_ID('dbo.CogitaDashboardPreferences'))
BEGIN
    CREATE INDEX IX_CogitaDashboardPreferences_UpdatedUtc ON dbo.CogitaDashboardPreferences (UpdatedUtc DESC);
END
GO

-- Chat module
-- Adds dedicated chat tables in separate [chat] schema.
-- Existing tables are not modified.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'chat')
BEGIN
    EXEC('CREATE SCHEMA chat AUTHORIZATION dbo;');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversations' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatConversations
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ChatType NVARCHAR(32) NOT NULL,
        ScopeType NVARCHAR(32) NOT NULL,
        ScopeId NVARCHAR(128) NULL,
        Title NVARCHAR(200) NOT NULL,
        Description NVARCHAR(2000) NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedByRoleId UNIQUEIDENTIFIER NULL,
        IsArchived BIT NOT NULL,
        IsPublic BIT NOT NULL,
        PublicReadEnabled BIT NOT NULL,
        PublicQuestionEnabled BIT NOT NULL,
        PublicCodeHash VARBINARY(32) NULL,
        ActiveKeyVersion INT NOT NULL,
        LastMessageSequence BIGINT NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ChatConversations_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT FK_ChatConversations_CreatedByRole FOREIGN KEY (CreatedByRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatConversations_UpdatedUtc' AND object_id = OBJECT_ID('chat.ChatConversations'))
BEGIN
    CREATE INDEX IX_ChatConversations_UpdatedUtc ON chat.ChatConversations(UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatConversations_ScopeUpdated' AND object_id = OBJECT_ID('chat.ChatConversations'))
BEGIN
    CREATE INDEX IX_ChatConversations_ScopeUpdated ON chat.ChatConversations(ScopeType, ScopeId, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatConversations_PublicCodeHash' AND object_id = OBJECT_ID('chat.ChatConversations'))
BEGIN
    CREATE INDEX IX_ChatConversations_PublicCodeHash ON chat.ChatConversations(PublicCodeHash)
    WHERE PublicCodeHash IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversationParticipants' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatConversationParticipants
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        SubjectType NVARCHAR(16) NOT NULL,
        SubjectId UNIQUEIDENTIFIER NOT NULL,
        DisplayLabel NVARCHAR(120) NULL,
        CanRead BIT NOT NULL,
        CanWrite BIT NOT NULL,
        CanManage BIT NOT NULL,
        CanRespondPublic BIT NOT NULL,
        MinReadableSequence BIGINT NOT NULL,
        JoinedUtc DATETIMEOFFSET NOT NULL,
        RemovedUtc DATETIMEOFFSET NULL,
        AddedByUserId UNIQUEIDENTIFIER NOT NULL,
        CONSTRAINT FK_ChatConversationParticipants_Conversation FOREIGN KEY (ConversationId) REFERENCES chat.ChatConversations(Id),
        CONSTRAINT FK_ChatConversationParticipants_AddedByUser FOREIGN KEY (AddedByUserId) REFERENCES dbo.UserAccounts(Id)
    );
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversationParticipants' AND schema_id = SCHEMA_ID('chat'))
    AND NOT EXISTS (
        SELECT 1
        FROM sys.columns
        WHERE object_id = OBJECT_ID('chat.ChatConversationParticipants')
          AND name = 'MinReadableSequence')
BEGIN
    ALTER TABLE chat.ChatConversationParticipants
        ADD MinReadableSequence BIGINT NOT NULL
            CONSTRAINT DF_ChatConversationParticipants_MinReadableSequence DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatConversationParticipants_ConversationRemoved' AND object_id = OBJECT_ID('chat.ChatConversationParticipants'))
BEGIN
    CREATE INDEX IX_ChatConversationParticipants_ConversationRemoved
        ON chat.ChatConversationParticipants(ConversationId, RemovedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatConversationParticipants_Subject' AND object_id = OBJECT_ID('chat.ChatConversationParticipants'))
BEGIN
    CREATE INDEX IX_ChatConversationParticipants_Subject
        ON chat.ChatConversationParticipants(ConversationId, SubjectType, SubjectId, RemovedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversationKeyVersions' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatConversationKeyVersions
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        Version INT NOT NULL,
        EncryptedKeyBlob VARBINARY(MAX) NOT NULL,
        Reason NVARCHAR(64) NOT NULL,
        RotatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ChatConversationKeyVersions_Conversation FOREIGN KEY (ConversationId) REFERENCES chat.ChatConversations(Id),
        CONSTRAINT FK_ChatConversationKeyVersions_RotatedByUser FOREIGN KEY (RotatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT UX_ChatConversationKeyVersions_ConversationVersion UNIQUE (ConversationId, Version)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatMessages' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatMessages
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        Sequence BIGINT NOT NULL,
        SenderUserId UNIQUEIDENTIFIER NULL,
        SenderRoleId UNIQUEIDENTIFIER NULL,
        SenderDisplay NVARCHAR(120) NOT NULL,
        MessageType NVARCHAR(24) NOT NULL,
        Visibility NVARCHAR(24) NOT NULL,
        ClientMessageId NVARCHAR(64) NULL,
        KeyVersion INT NOT NULL,
        Ciphertext VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        EditedUtc DATETIMEOFFSET NULL,
        DeletedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_ChatMessages_Conversation FOREIGN KEY (ConversationId) REFERENCES chat.ChatConversations(Id),
        CONSTRAINT FK_ChatMessages_SenderUser FOREIGN KEY (SenderUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT FK_ChatMessages_SenderRole FOREIGN KEY (SenderRoleId) REFERENCES dbo.Roles(Id),
        CONSTRAINT UX_ChatMessages_ConversationSequence UNIQUE (ConversationId, Sequence)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatMessages_ConversationCreated' AND object_id = OBJECT_ID('chat.ChatMessages'))
BEGIN
    CREATE INDEX IX_ChatMessages_ConversationCreated
        ON chat.ChatMessages(ConversationId, CreatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatMessages_ConversationVisibilitySequence' AND object_id = OBJECT_ID('chat.ChatMessages'))
BEGIN
    CREATE INDEX IX_ChatMessages_ConversationVisibilitySequence
        ON chat.ChatMessages(ConversationId, Visibility, Sequence);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatConversationReadStates' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatConversationReadStates
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        LastReadSequence BIGINT NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ChatConversationReadStates_Conversation FOREIGN KEY (ConversationId) REFERENCES chat.ChatConversations(Id),
        CONSTRAINT FK_ChatConversationReadStates_User FOREIGN KEY (UserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT UX_ChatConversationReadStates_ConversationUser UNIQUE (ConversationId, UserId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ChatPublicLinks' AND schema_id = SCHEMA_ID('chat'))
BEGIN
    CREATE TABLE chat.ChatPublicLinks
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ConversationId UNIQUEIDENTIFIER NOT NULL,
        CodeHash VARBINARY(32) NOT NULL,
        Label NVARCHAR(120) NOT NULL,
        IsActive BIT NOT NULL,
        ExpiresUtc DATETIMEOFFSET NULL,
        CreatedByUserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        LastUsedUtc DATETIMEOFFSET NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_ChatPublicLinks_Conversation FOREIGN KEY (ConversationId) REFERENCES chat.ChatConversations(Id),
        CONSTRAINT FK_ChatPublicLinks_CreatedByUser FOREIGN KEY (CreatedByUserId) REFERENCES dbo.UserAccounts(Id),
        CONSTRAINT UX_ChatPublicLinks_CodeHash UNIQUE (CodeHash)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChatPublicLinks_ConversationActive' AND object_id = OBJECT_ID('chat.ChatPublicLinks'))
BEGIN
    CREATE INDEX IX_ChatPublicLinks_ConversationActive
        ON chat.ChatPublicLinks(ConversationId, IsActive, RevokedUtc, ExpiresUtc);
END
GO

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
        IsPublicQuestion BIT NOT NULL CONSTRAINT DF_PilgrimageContactInquiries_IsPublicQuestion DEFAULT(0),
        Email NVARCHAR(180) NULL,
        Topic NVARCHAR(120) NOT NULL,
        Message NVARCHAR(2400) NOT NULL,
        Status NVARCHAR(32) NOT NULL,
        PublicAnswer NVARCHAR(2400) NULL,
        PublicAnsweredBy NVARCHAR(180) NULL,
        PublicAnsweredUtc DATETIMEOFFSET NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_PilgrimageContactInquiries_Event FOREIGN KEY (EventId) REFERENCES pilgrimage.PilgrimageEvents(Id)
    );
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageContactInquiries', 'PublicAnswer') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageContactInquiries ADD PublicAnswer NVARCHAR(2400) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageContactInquiries', 'IsPublicQuestion') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageContactInquiries ADD IsPublicQuestion BIT NOT NULL CONSTRAINT DF_PilgrimageContactInquiries_IsPublicQuestion DEFAULT(0);
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageContactInquiries', 'PublicAnsweredBy') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageContactInquiries ADD PublicAnsweredBy NVARCHAR(180) NULL;
END
GO

IF COL_LENGTH('pilgrimage.PilgrimageContactInquiries', 'PublicAnsweredUtc') IS NULL
BEGIN
    ALTER TABLE pilgrimage.PilgrimageContactInquiries ADD PublicAnsweredUtc DATETIMEOFFSET NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PilgrimageContactInquiries_EventStatusUpdated' AND object_id = OBJECT_ID('pilgrimage.PilgrimageContactInquiries'))
BEGIN
    CREATE INDEX IX_PilgrimageContactInquiries_EventStatusUpdated ON pilgrimage.PilgrimageContactInquiries(EventId, Status, UpdatedUtc);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PortalAdminAssignments' AND schema_id = SCHEMA_ID('pilgrimage'))
BEGIN
    CREATE TABLE pilgrimage.PortalAdminAssignments
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ScopeKey NVARCHAR(64) NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PortalAdminAssignments_ScopeKey' AND object_id = OBJECT_ID('pilgrimage.PortalAdminAssignments'))
BEGIN
    CREATE UNIQUE INDEX UX_PortalAdminAssignments_ScopeKey ON pilgrimage.PortalAdminAssignments(ScopeKey);
END
GO

/*
  Runtime compatibility: force CogitaRevisionShares to the schema used by current API endpoints.
  This block is intentionally placed at the end so it wins over any legacy earlier definitions.
*/
IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'PublicCodeHash') IS NULL
BEGIN
    DECLARE @legacyName SYSNAME =
        N'CogitaRevisionShares_Legacy_' +
        CONVERT(NVARCHAR(8), GETUTCDATE(), 112) +
        REPLACE(CONVERT(NVARCHAR(8), GETUTCDATE(), 108), ':', '');
    EXEC sp_rename N'dbo.CogitaRevisionShares', @legacyName;
END
GO

IF OBJECT_ID(N'dbo.CogitaRevisionShares', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaRevisionShares
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        RevisionId UNIQUEIDENTIFIER NOT NULL,
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
        FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        FOREIGN KEY (RevisionId) REFERENCES dbo.CogitaRevisions(Id),
        FOREIGN KEY (CollectionId) REFERENCES dbo.CogitaInfos(Id),
        FOREIGN KEY (SharedViewId) REFERENCES dbo.SharedViews(Id),
        FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_Library_Revoked' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'LibraryId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaRevisionShares_Library_Revoked ON dbo.CogitaRevisionShares(LibraryId, RevokedUtc);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_Library_Revision_Revoked' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'LibraryId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'RevisionId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaRevisionShares_Library_Revision_Revoked ON dbo.CogitaRevisionShares(LibraryId, RevisionId, RevokedUtc);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaRevisionShares_ActiveRevision' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'RevisionId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_CogitaRevisionShares_ActiveRevision ON dbo.CogitaRevisionShares(RevisionId) WHERE RevokedUtc IS NULL;');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaRevisionShares_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaRevisionShares'))
   AND COL_LENGTH('dbo.CogitaRevisionShares', 'PublicCodeHash') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaRevisionShares_PublicCodeHash ON dbo.CogitaRevisionShares(PublicCodeHash);');
END
GO

/*
  Runtime compatibility: ensure CogitaStoryboardShares matches current API schema.
*/
IF OBJECT_ID(N'dbo.CogitaStoryboardShares', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaStoryboardShares
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ProjectId UNIQUEIDENTIFIER NOT NULL,
        OwnerRoleId UNIQUEIDENTIFIER NOT NULL,
        PublicCodeHash VARBINARY(64) NOT NULL,
        EncShareCode VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        RevokedUtc DATETIMEOFFSET NULL,
        FOREIGN KEY (LibraryId) REFERENCES dbo.CogitaLibraries(Id),
        FOREIGN KEY (ProjectId) REFERENCES dbo.CogitaCreationProjects(Id),
        FOREIGN KEY (OwnerRoleId) REFERENCES dbo.Roles(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_Library_Revoked' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'LibraryId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaStoryboardShares_Library_Revoked ON dbo.CogitaStoryboardShares(LibraryId, RevokedUtc);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_Library_Project_Revoked' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'LibraryId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'ProjectId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaStoryboardShares_Library_Project_Revoked ON dbo.CogitaStoryboardShares(LibraryId, ProjectId, RevokedUtc);');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_CogitaStoryboardShares_ActiveProject' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'ProjectId') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'RevokedUtc') IS NOT NULL
BEGIN
    EXEC(N'CREATE UNIQUE INDEX UX_CogitaStoryboardShares_ActiveProject ON dbo.CogitaStoryboardShares(ProjectId) WHERE RevokedUtc IS NULL;');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CogitaStoryboardShares_PublicCodeHash' AND object_id = OBJECT_ID('dbo.CogitaStoryboardShares'))
   AND COL_LENGTH('dbo.CogitaStoryboardShares', 'PublicCodeHash') IS NOT NULL
BEGIN
    EXEC(N'CREATE INDEX IX_CogitaStoryboardShares_PublicCodeHash ON dbo.CogitaStoryboardShares(PublicCodeHash);');
END
GO
