/* Complete read-receipt support on installations with an earlier chat_presence
   table. Migration 0060 only creates absent tables; it does not add columns to
   an existing table. Both /features and /seen require these columns.
   Run 0060 first. Existing presence rows and message data are preserved. */
IF OBJECT_ID(N'app.chat_presence', N'U') IS NULL
BEGIN
    RAISERROR(N'Missing app.chat_presence. Apply 0060_chat_features.sql before 0061.', 16, 1);
END
ELSE
BEGIN
    IF COL_LENGTH(N'app.chat_presence', N'read_at') IS NULL
        ALTER TABLE app.chat_presence ADD read_at datetimeoffset(7) NULL;

    IF COL_LENGTH(N'app.chat_presence', N'is_seat') IS NULL
        ALTER TABLE app.chat_presence ADD is_seat bit NOT NULL
            CONSTRAINT df_chat_presence_seat DEFAULT (0);
END
GO
