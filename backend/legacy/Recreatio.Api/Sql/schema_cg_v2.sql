DROP INDEX IX_CgFieldValues_FieldDefId_SearchFloat ON dbo.CgFieldValues;
DROP INDEX IX_CgFieldValues_FieldDefId_SearchHash ON dbo.CgFieldValues;
ALTER TABLE dbo.CgFieldValues DROP COLUMN SearchFloat, SearchHash;