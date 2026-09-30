/* Read-only: run in the database used by the deployed backend/Api application.
   Missing or mismatched objects explain which migration is incomplete.
   This file is intentionally outside the embedded migration directory. */
SELECT DB_NAME() AS database_name, SERVERPROPERTY('ProductVersion') AS server_version;

SELECT N'app.' + expected.table_name AS table_name, expected.column_name,
       expected.type_name AS expected_type, TYPE_NAME(actual.user_type_id) AS actual_type,
       CASE WHEN actual.column_id IS NULL THEN N'MISSING'
            WHEN TYPE_NAME(actual.user_type_id) <> expected.type_name THEN N'TYPE MISMATCH'
            ELSE N'OK' END AS status
FROM (VALUES
    (N'chat', N'posting_policy', N'nvarchar'),
    (N'chat_message', N'scheduled_at', N'datetimeoffset'),
    (N'chat_message', N'schedule_state', N'nvarchar'),
    (N'chat_preference', N'principal_id', N'uniqueidentifier'),
    (N'chat_preference', N'scope_id', N'uniqueidentifier'),
    (N'chat_preference', N'settings', N'nvarchar'),
    (N'chat_presence', N'chat_id', N'uniqueidentifier'),
    (N'chat_presence', N'principal_id', N'uniqueidentifier'),
    (N'chat_presence', N'typing_until', N'datetimeoffset'),
    (N'chat_presence', N'read_at', N'datetimeoffset'),
    (N'chat_presence', N'is_seat', N'bit'),
    (N'chat_mark', N'message_id', N'uniqueidentifier'),
    (N'chat_mark', N'principal_id', N'uniqueidentifier'),
    (N'chat_mark', N'kind', N'nvarchar'),
    (N'chat_mark', N'value', N'nvarchar'),
    (N'chat_attachment', N'id', N'uniqueidentifier'),
    (N'chat_attachment', N'chat_id', N'uniqueidentifier'),
    (N'chat_attachment', N'uploaded_by', N'uniqueidentifier'),
    (N'chat_attachment', N'byte_length', N'bigint'),
    (N'chat_attachment', N'created_at', N'datetimeoffset')
) AS expected(table_name, column_name, type_name)
LEFT JOIN sys.columns AS actual
    ON actual.object_id = OBJECT_ID(N'app.' + expected.table_name, N'U')
   AND actual.name = expected.column_name
ORDER BY expected.table_name, expected.column_name;
