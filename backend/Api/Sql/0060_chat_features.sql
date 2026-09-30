/* Chat policies, durable scheduling, preferences and encrypted disk attachments.
   Settings JSON is validated and serialized by Chat.SavePreferencesAsync.
   Do not require database JSON functions: this deployment does not support them.
   Guards allow resuming after partially executed manual GO batches.
*/
IF COL_LENGTH('app.chat', 'posting_policy') IS NULL
    ALTER TABLE app.chat ADD posting_policy nvarchar(12) NOT NULL CONSTRAINT df_chat_policy DEFAULT N'legacy';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('app.chat') AND name = N'ck_chat_policy')
    ALTER TABLE app.chat ADD CONSTRAINT ck_chat_policy CHECK (posting_policy IN (N'legacy', N'members', N'writers'));
IF COL_LENGTH('app.chat_message', 'scheduled_at') IS NULL
    ALTER TABLE app.chat_message ADD scheduled_at datetimeoffset(7) NULL;
IF COL_LENGTH('app.chat_message', 'schedule_state') IS NULL
    ALTER TABLE app.chat_message ADD schedule_state nvarchar(12) NOT NULL CONSTRAINT df_message_schedule DEFAULT N'sent';
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('app.chat_message') AND name = N'ck_message_schedule')
    ALTER TABLE app.chat_message ADD CONSTRAINT ck_message_schedule CHECK (schedule_state IN (N'sent', N'pending', N'cancelled', N'failed'));
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('app.chat_message') AND name = N'ix_chat_schedule')
    CREATE INDEX ix_chat_schedule ON app.chat_message(schedule_state, scheduled_at);
GO
IF OBJECT_ID('app.chat_preference', 'U') IS NULL
CREATE TABLE app.chat_preference (
    principal_id uniqueidentifier NOT NULL,
    scope_id uniqueidentifier NOT NULL,
    settings nvarchar(6000) NOT NULL,
    CONSTRAINT pk_chat_preference PRIMARY KEY(principal_id, scope_id)
);
/* scope_id = zero GUID means the common account/seat settings. */
IF OBJECT_ID('app.chat_attachment', 'U') IS NULL
CREATE TABLE app.chat_attachment (
    id uniqueidentifier NOT NULL CONSTRAINT pk_chat_attachment PRIMARY KEY,
    chat_id uniqueidentifier NOT NULL REFERENCES app.chat(id),
    uploaded_by uniqueidentifier NOT NULL,
    byte_length bigint NOT NULL,
    created_at datetimeoffset(7) NOT NULL,
    CONSTRAINT ck_chat_attachment_length CHECK (byte_length BETWEEN 1 AND 52428800)
);
/* Only opaque identifiers, size and access metadata: bytes, names and MIME types never enter SQL. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('app.chat_attachment') AND name = N'ix_chat_attachment_owner')
    CREATE INDEX ix_chat_attachment_owner ON app.chat_attachment(uploaded_by, created_at);
IF OBJECT_ID('app.chat_mark', 'U') IS NULL
CREATE TABLE app.chat_mark (
    message_id uniqueidentifier NOT NULL REFERENCES app.chat_message(id),
    principal_id uniqueidentifier NOT NULL,
    kind nvarchar(12) NOT NULL,
    value nvarchar(32) NOT NULL,
    CONSTRAINT pk_chat_mark PRIMARY KEY(message_id, principal_id, kind),
    CONSTRAINT ck_chat_mark_kind CHECK (kind IN (N'reaction', N'star', N'pin'))
);
IF OBJECT_ID('app.chat_presence', 'U') IS NULL
CREATE TABLE app.chat_presence (
    chat_id uniqueidentifier NOT NULL REFERENCES app.chat(id),
    principal_id uniqueidentifier NOT NULL,
    typing_until datetimeoffset(7) NOT NULL,
    read_at datetimeoffset(7) NULL,
    is_seat bit NOT NULL CONSTRAINT df_chat_presence_seat DEFAULT 0,
    CONSTRAINT pk_chat_presence PRIMARY KEY(chat_id, principal_id)
);
GO
