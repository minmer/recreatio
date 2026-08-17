IF COL_LENGTH('dbo.ParishConfirmationSmsTemplates', 'YearSummaryCompleteTemplate') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationSmsTemplates
        ADD YearSummaryCompleteTemplate NVARCHAR(MAX) NOT NULL
            CONSTRAINT DF_ParishConfirmationSmsTemplates_YearSummaryCompleteTemplate DEFAULT N'';
END
GO

IF COL_LENGTH('dbo.ParishConfirmationSmsTemplates', 'YearSummaryIncompleteTemplate') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationSmsTemplates
        ADD YearSummaryIncompleteTemplate NVARCHAR(MAX) NOT NULL
            CONSTRAINT DF_ParishConfirmationSmsTemplates_YearSummaryIncompleteTemplate DEFAULT N'';
END
GO
