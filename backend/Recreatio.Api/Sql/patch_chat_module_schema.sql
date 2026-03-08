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
