IF COL_LENGTH('dbo.ParishConfirmationCandidates', 'PaperIndexChecked') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationCandidates
        ADD PaperIndexChecked BIT NOT NULL CONSTRAINT DF_ParishConfirmationCandidates_PaperIndexChecked DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.ParishConfirmationCandidates', 'QuizCompleted') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationCandidates
        ADD QuizCompleted BIT NOT NULL CONSTRAINT DF_ParishConfirmationCandidates_QuizCompleted DEFAULT 0;
END
GO
