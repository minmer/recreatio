-- ReCreatio schema audit (SQL Server)
-- Validates required tables, flags extras, checks columns, indexes, and FKs.
-- Run in the target database (e.g. USE [minmer_zap_25];)

SET NOCOUNT ON;

DECLARE @ExpectedTables TABLE (TableName sysname);
INSERT INTO @ExpectedTables (TableName)
VALUES
  ('UserAccounts'),
  ('Roles'),
  ('RoleEdges'),
  ('Keys'),
  ('Memberships'),
  ('Sessions'),
  ('SharedViews'),
  ('AuthLedger'),
  ('KeyLedger'),
  ('BusinessLedger');

-- 1) Missing / extra tables
SELECT e.TableName AS MissingTable
FROM @ExpectedTables e
LEFT JOIN sys.tables t ON t.name = e.TableName
WHERE t.object_id IS NULL;

SELECT t.name AS ExtraTable
FROM sys.tables t
LEFT JOIN @ExpectedTables e ON e.TableName = t.name
WHERE e.TableName IS NULL
  AND t.schema_id = SCHEMA_ID('dbo');

-- 2) Table + column snapshot (required tables only)
SELECT
  t.name AS table_name,
  c.column_id,
  c.name AS column_name,
  TYPE_NAME(c.user_type_id) AS type_name,
  c.max_length,
  c.is_nullable
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
WHERE t.name IN (SELECT TableName FROM @ExpectedTables)
ORDER BY t.name, c.column_id;

-- 3) Index expectations
SELECT
  t.name AS table_name,
  i.name AS index_name,
  i.is_unique,
  i.is_primary_key
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
WHERE t.name IN ('UserAccounts', 'Sessions')
ORDER BY t.name, i.name;

-- 4) Foreign keys check (auth/session/role graph)
SELECT
  fk.name AS fk_name,
  tp.name AS parent_table,
  cp.name AS parent_column,
  tr.name AS referenced_table,
  cr.name AS referenced_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
JOIN sys.columns cp ON cp.object_id = tp.object_id AND cp.column_id = fkc.parent_column_id
JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
JOIN sys.columns cr ON cr.object_id = tr.object_id AND cr.column_id = fkc.referenced_column_id
WHERE tp.name IN ('UserAccounts', 'Roles', 'RoleEdges', 'Keys', 'Memberships', 'Sessions', 'SharedViews');

-- 5) Quick counts for core tables
SELECT 'UserAccounts' AS table_name, COUNT(*) AS row_count FROM dbo.UserAccounts
UNION ALL
SELECT 'Roles', COUNT(*) FROM dbo.Roles
UNION ALL
SELECT 'RoleEdges', COUNT(*) FROM dbo.RoleEdges
UNION ALL
SELECT 'Keys', COUNT(*) FROM dbo.Keys
UNION ALL
SELECT 'Memberships', COUNT(*) FROM dbo.Memberships
UNION ALL
SELECT 'Sessions', COUNT(*) FROM dbo.Sessions
UNION ALL
SELECT 'SharedViews', COUNT(*) FROM dbo.SharedViews
UNION ALL
SELECT 'AuthLedger', COUNT(*) FROM dbo.AuthLedger
UNION ALL
SELECT 'KeyLedger', COUNT(*) FROM dbo.KeyLedger
UNION ALL
SELECT 'BusinessLedger', COUNT(*) FROM dbo.BusinessLedger;
