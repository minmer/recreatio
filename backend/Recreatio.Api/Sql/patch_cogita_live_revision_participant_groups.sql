/*
  Live revision participant classes/groups
  - Adds GroupName to participants and relogin requests
  - Adds lookup indexes for name+group matching
*/

IF OBJECT_ID('dbo.CogitaLiveRevisionParticipants', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'GroupName') IS NULL
    BEGIN
        ALTER TABLE dbo.CogitaLiveRevisionParticipants ADD GroupName NVARCHAR(120) NULL;
    END
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionParticipants', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'GroupName') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE dbo.CogitaLiveRevisionParticipants
        SET GroupName = NULL
        WHERE GroupName IS NOT NULL AND LEN(LTRIM(RTRIM(GroupName))) = 0;
    ');
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionParticipants', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'GroupName') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_CogitaLiveRevisionParticipants_SessionNameGroup'
         AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionParticipants'))
BEGIN
    EXEC(N'
        CREATE INDEX IX_CogitaLiveRevisionParticipants_SessionNameGroup
            ON dbo.CogitaLiveRevisionParticipants(SessionId, DisplayName, GroupName);
    ');
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionParticipants', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionParticipants', 'GroupName') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_CogitaLiveRevisionParticipants_SessionNameHashGroup'
         AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionParticipants'))
BEGIN
    EXEC(N'
        CREATE INDEX IX_CogitaLiveRevisionParticipants_SessionNameHashGroup
            ON dbo.CogitaLiveRevisionParticipants(SessionId, DisplayNameHash, GroupName);
    ');
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'GroupName') IS NULL
    BEGIN
        ALTER TABLE dbo.CogitaLiveRevisionReloginRequests ADD GroupName NVARCHAR(120) NULL;
    END
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'GroupName') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE dbo.CogitaLiveRevisionReloginRequests
        SET GroupName = NULL
        WHERE GroupName IS NOT NULL AND LEN(LTRIM(RTRIM(GroupName))) = 0;
    ');
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'GroupName') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_CogitaLiveRevisionReloginRequests_SessionNameGroupStatus'
         AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests'))
BEGIN
    EXEC(N'
        CREATE INDEX IX_CogitaLiveRevisionReloginRequests_SessionNameGroupStatus
            ON dbo.CogitaLiveRevisionReloginRequests(SessionId, DisplayName, GroupName, Status);
    ');
END
GO

IF OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.CogitaLiveRevisionReloginRequests', 'GroupName') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = 'IX_CogitaLiveRevisionReloginRequests_SessionNameHashGroupStatus'
         AND object_id = OBJECT_ID('dbo.CogitaLiveRevisionReloginRequests'))
BEGIN
    EXEC(N'
        CREATE INDEX IX_CogitaLiveRevisionReloginRequests_SessionNameHashGroupStatus
            ON dbo.CogitaLiveRevisionReloginRequests(SessionId, DisplayNameHash, GroupName, Status);
    ');
END
GO
