IF COL_LENGTH('dbo.ParishConfirmationMeetingLinks', 'Stage') IS NULL
BEGIN
    ALTER TABLE dbo.ParishConfirmationMeetingLinks
        ADD Stage NVARCHAR(32) NOT NULL
            CONSTRAINT DF_ParishConfirmationMeetingLinks_Stage DEFAULT ('year1-start');
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_ParishConfirmationMeetingLinks_Stage'
      AND parent_object_id = OBJECT_ID('dbo.ParishConfirmationMeetingLinks')
)
BEGIN
    ALTER TABLE dbo.ParishConfirmationMeetingLinks
        ADD CONSTRAINT CK_ParishConfirmationMeetingLinks_Stage
            CHECK (Stage IN ('year1-start', 'year1-end'));
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_ParishConfirmationMeetingLinks_Candidate'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingLinks')
)
BEGIN
    DROP INDEX UX_ParishConfirmationMeetingLinks_Candidate
        ON dbo.ParishConfirmationMeetingLinks;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_ParishConfirmationMeetingLinks_CandidateStage'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingLinks')
)
BEGIN
    CREATE UNIQUE INDEX UX_ParishConfirmationMeetingLinks_CandidateStage
        ON dbo.ParishConfirmationMeetingLinks(CandidateId, Stage);
END
GO
