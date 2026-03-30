IF OBJECT_ID(N'dbo.ParishConfirmationSmsTemplates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationSmsTemplates
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        VerificationInviteTemplate NVARCHAR(MAX) NOT NULL,
        VerificationWarningTemplate NVARCHAR(MAX) NOT NULL,
        PortalInviteTemplate NVARCHAR(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT UX_ParishConfirmationSmsTemplates_Parish UNIQUE (ParishId),
        CONSTRAINT FK_ParishConfirmationSmsTemplates_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
    );
END
GO
