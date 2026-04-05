SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.CogitaPythonInfos', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CogitaPythonInfos
    (
        InfoId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_CogitaPythonInfos PRIMARY KEY,
        DataKeyId UNIQUEIDENTIFIER NOT NULL,
        EncryptedBlob VARBINARY(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_CogitaPythonInfos_Info FOREIGN KEY (InfoId) REFERENCES dbo.CogitaInfos(Id)
    );
END;

IF OBJECT_ID(N'dbo.CogitaComputedInfos', N'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.CogitaPythonInfos (InfoId, DataKeyId, EncryptedBlob, CreatedUtc, UpdatedUtc)
    SELECT ci.InfoId, ci.DataKeyId, ci.EncryptedBlob, ci.CreatedUtc, ci.UpdatedUtc
    FROM dbo.CogitaComputedInfos ci
    INNER JOIN dbo.CogitaInfos i ON i.Id = ci.InfoId
    LEFT JOIN dbo.CogitaPythonInfos p ON p.InfoId = ci.InfoId
    WHERE i.InfoType = N'python'
      AND p.InfoId IS NULL;

    DELETE ci
    FROM dbo.CogitaComputedInfos ci
    INNER JOIN dbo.CogitaInfos i ON i.Id = ci.InfoId
    WHERE i.InfoType = N'python';
END;

COMMIT TRANSACTION;
