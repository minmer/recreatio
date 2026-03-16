IF OBJECT_ID('dbo.ParishConfirmationMeetingJoinRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishConfirmationMeetingJoinRequests
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        SlotId UNIQUEIDENTIFIER NOT NULL,
        RequestedByCandidateId UNIQUEIDENTIFIER NOT NULL,
        HostCandidateId UNIQUEIDENTIFIER NOT NULL,
        Status NVARCHAR(16) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        DecidedUtc DATETIMEOFFSET NULL,
        CONSTRAINT FK_ParishConfirmationMeetingJoinRequests_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id),
        CONSTRAINT FK_ParishConfirmationMeetingJoinRequests_Slot FOREIGN KEY (SlotId) REFERENCES dbo.ParishConfirmationMeetingSlots(Id),
        CONSTRAINT FK_ParishConfirmationMeetingJoinRequests_RequestedCandidate FOREIGN KEY (RequestedByCandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
        CONSTRAINT FK_ParishConfirmationMeetingJoinRequests_HostCandidate FOREIGN KEY (HostCandidateId) REFERENCES dbo.ParishConfirmationCandidates(Id),
        CONSTRAINT CK_ParishConfirmationMeetingJoinRequests_Status CHECK (Status IN ('pending', 'accepted', 'rejected', 'cancelled'))
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationMeetingJoinRequests_ParishSlotStatusCreated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingJoinRequests'))
BEGIN
    CREATE INDEX IX_ParishConfirmationMeetingJoinRequests_ParishSlotStatusCreated
        ON dbo.ParishConfirmationMeetingJoinRequests(ParishId, SlotId, Status, CreatedUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationMeetingJoinRequests_ParishHostStatusCreated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingJoinRequests'))
BEGIN
    CREATE INDEX IX_ParishConfirmationMeetingJoinRequests_ParishHostStatusCreated
        ON dbo.ParishConfirmationMeetingJoinRequests(ParishId, HostCandidateId, Status, CreatedUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationMeetingJoinRequests_ParishRequestedStatusCreated'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingJoinRequests'))
BEGIN
    CREATE INDEX IX_ParishConfirmationMeetingJoinRequests_ParishRequestedStatusCreated
        ON dbo.ParishConfirmationMeetingJoinRequests(ParishId, RequestedByCandidateId, Status, CreatedUtc);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_ParishConfirmationMeetingJoinRequests_SlotRequestedStatus'
      AND object_id = OBJECT_ID('dbo.ParishConfirmationMeetingJoinRequests'))
BEGIN
    CREATE INDEX IX_ParishConfirmationMeetingJoinRequests_SlotRequestedStatus
        ON dbo.ParishConfirmationMeetingJoinRequests(SlotId, RequestedByCandidateId, Status);
END
GO
