IF OBJECT_ID(N'dbo.ParishConfirmationMeetingLinks', N'U') IS NOT NULL
   AND COL_LENGTH('dbo.ParishConfirmationMeetingLinks', 'CompletedManually') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationMeetingLinks
        ADD CompletedManually BIT NOT NULL
            CONSTRAINT DF_ParishConfirmationMeetingLinks_CompletedManually DEFAULT (0);
END
GO
