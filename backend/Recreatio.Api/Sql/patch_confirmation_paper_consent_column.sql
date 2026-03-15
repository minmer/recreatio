IF COL_LENGTH('dbo.ParishConfirmationCandidates', 'PaperConsentReceived') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationCandidates
        ADD PaperConsentReceived BIT NOT NULL
            CONSTRAINT DF_ParishConfirmationCandidates_PaperConsentReceived DEFAULT 0 WITH VALUES;
END
GO
