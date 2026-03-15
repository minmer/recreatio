IF OBJECT_ID('dbo.ParishMassRules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ParishMassRules
    (
        Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        ParishId UNIQUEIDENTIFIER NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(600) NULL,
        GraphJson NVARCHAR(MAX) NOT NULL,
        CreatedUtc DATETIMEOFFSET NOT NULL,
        UpdatedUtc DATETIMEOFFSET NOT NULL,
        CONSTRAINT FK_ParishMassRules_Parish FOREIGN KEY (ParishId) REFERENCES dbo.Parishes(Id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ParishMassRules_ParishName' AND object_id = OBJECT_ID('dbo.ParishMassRules'))
BEGIN
    CREATE INDEX IX_ParishMassRules_ParishName ON dbo.ParishMassRules(ParishId, Name);
END
GO
