/*
  Adds file-storage reference columns for encrypted blob storage.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID(N'dbo.DataItems', N'U') IS NULL
    BEGIN
        RAISERROR('Table dbo.DataItems does not exist. Apply schema.sql first.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    IF COL_LENGTH('dbo.DataItems', 'StorageProvider') IS NULL
    BEGIN
        ALTER TABLE dbo.DataItems
            ADD StorageProvider NVARCHAR(32) NULL;
    END;

    IF COL_LENGTH('dbo.DataItems', 'StoragePath') IS NULL
    BEGIN
        ALTER TABLE dbo.DataItems
            ADD StoragePath NVARCHAR(512) NULL;
    END;

    IF COL_LENGTH('dbo.DataItems', 'StorageSizeBytes') IS NULL
    BEGIN
        ALTER TABLE dbo.DataItems
            ADD StorageSizeBytes BIGINT NULL;
    END;

    IF COL_LENGTH('dbo.DataItems', 'StorageSha256') IS NULL
    BEGIN
        ALTER TABLE dbo.DataItems
            ADD StorageSha256 VARBINARY(32) NULL;
    END;

    COMMIT TRANSACTION;

    SELECT
        N'dbo.DataItems file-storage columns ensured.' AS Result;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
    BEGIN
        ROLLBACK TRANSACTION;
    END;

    THROW;
END CATCH;
GO
