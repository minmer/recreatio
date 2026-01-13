-- ReCreatio schema sanity checks (SQL Server)
-- Run in the target database (e.g. USE [minmer_zap_25];)

-- 1) Ensure core tables exist
SELECT t.name AS table_name
FROM sys.tables t
WHERE t.name IN (
    'UserAccounts',
    'Roles',
    'RoleEdges',
    'Keys',
    'Memberships',
    'Sessions',
    'SharedViews',
    'AuthLedger',
    'KeyLedger',
    'BusinessLedger'
)
ORDER BY t.name;

-- 2) Check required columns for UserAccounts
SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS type_name, c.max_length, c.is_nullable
FROM sys.columns c
WHERE c.object_id = OBJECT_ID(N'dbo.UserAccounts')
ORDER BY c.column_id;

-- 3) Check required columns for Sessions
SELECT c.name AS column_name, TYPE_NAME(c.user_type_id) AS type_name, c.max_length, c.is_nullable
FROM sys.columns c
WHERE c.object_id = OBJECT_ID(N'dbo.Sessions')
ORDER BY c.column_id;

-- 4) Verify unique indexes on LoginId and SessionId
SELECT t.name AS table_name, i.name AS index_name, i.is_unique
FROM sys.indexes i
JOIN sys.tables t ON t.object_id = i.object_id
WHERE t.name IN ('UserAccounts', 'Sessions') AND i.name LIKE 'UX_%'
ORDER BY t.name, i.name;

-- 5) Validate foreign keys for auth/session tables
SELECT fk.name AS fk_name, tp.name AS parent_table, tr.name AS referenced_table
FROM sys.foreign_keys fk
JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
WHERE tp.name IN ('UserAccounts', 'Sessions', 'Memberships');

-- 6) Quick health checks
SELECT COUNT(*) AS user_count FROM dbo.UserAccounts;
SELECT COUNT(*) AS active_sessions FROM dbo.Sessions WHERE IsRevoked = 0;
SELECT TOP (20) UserId, SessionId, IsSecureMode, LastActivityUtc
FROM dbo.Sessions
ORDER BY LastActivityUtc DESC;
