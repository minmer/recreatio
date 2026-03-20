/*
  Cogita storyboard shared-link migration
  - Ensures schema supports public storyboard notion/card reads (EncLibraryReadKey)
  - Revokes and removes old storyboard links created before this column existed
  - Leaves storyboard projects untouched (old storyboards remain available)

  After running this patch:
  - Create a new storyboard shared link from the app/API.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.CogitaStoryboardShares', N'U') IS NULL
    BEGIN
        RAISERROR('Table dbo.CogitaStoryboardShares does not exist. Apply schema.sql first.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    IF COL_LENGTH('dbo.CogitaStoryboardShares', 'EncLibraryReadKey') IS NULL
    BEGIN
        ALTER TABLE dbo.CogitaStoryboardShares
            ADD EncLibraryReadKey VARBINARY(MAX) NULL;
    END;

    DECLARE @nowUtc DATETIMEOFFSET = SYSUTCDATETIME();
    DECLARE @revokedCount INT = 0;
    DECLARE @deletedCount INT = 0;
    CREATE TABLE #removedLinks
    (
        LibraryId UNIQUEIDENTIFIER NOT NULL,
        ProjectId UNIQUEIDENTIFIER NOT NULL
    );

    DECLARE @sqlRevoke NVARCHAR(MAX) = N'
        UPDATE dbo.CogitaStoryboardShares
        SET RevokedUtc = COALESCE(RevokedUtc, @nowUtc)
        WHERE RevokedUtc IS NULL
          AND (EncLibraryReadKey IS NULL OR DATALENGTH(EncLibraryReadKey) = 0);
        SELECT @affected = @@ROWCOUNT;
    ';

    EXEC sp_executesql
        @sqlRevoke,
        N'@nowUtc DATETIMEOFFSET, @affected INT OUTPUT',
        @nowUtc = @nowUtc,
        @affected = @revokedCount OUTPUT;

    DECLARE @sqlDelete NVARCHAR(MAX) = N'
        DELETE FROM dbo.CogitaStoryboardShares
        OUTPUT deleted.LibraryId, deleted.ProjectId INTO #removedLinks(LibraryId, ProjectId)
        WHERE EncLibraryReadKey IS NULL OR DATALENGTH(EncLibraryReadKey) = 0;
        SELECT @affected = @@ROWCOUNT;
    ';

    EXEC sp_executesql
        @sqlDelete,
        N'@affected INT OUTPUT',
        @affected = @deletedCount OUTPUT;

    COMMIT TRANSACTION;

    SELECT
        @revokedCount AS RevokedOldStoryboardLinks,
        @deletedCount AS DeletedOldStoryboardLinks,
        N'Create a new shared link in Cogita storyboard workspace (or POST /cogita/libraries/{libraryId}/storyboard-shares).' AS NextStep;

    SELECT DISTINCT
        removed.LibraryId,
        removed.ProjectId,
        project.Name AS ProjectName
    FROM #removedLinks AS removed
    LEFT JOIN dbo.CogitaCreationProjects AS project
        ON project.Id = removed.ProjectId
       AND project.LibraryId = removed.LibraryId
    ORDER BY project.Name;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
GO
