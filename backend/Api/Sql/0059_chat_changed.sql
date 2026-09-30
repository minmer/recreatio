/*
    WAS SICH AN EINER NACHRICHT GEÄNDERT HAT (0059).

    Seit 0058 lassen sich Nachrichten bearbeiten, löschen und wiederherstellen.
    Wer die Rozmowa offen hat, holt alle paar Sekunden nur das NEUE — eine
    bearbeitete Nachricht von gestern wäre bei ihm nie angekommen. `changed_at`
    sagt, wann an einer Nachricht zuletzt etwas geschah (bearbeitet, gelöscht,
    wiederhergestellt), und das Nachladen fragt auch danach.
*/

IF COL_LENGTH('app.chat_message', 'changed_at') IS NULL
    ALTER TABLE app.chat_message ADD changed_at datetimeoffset(7) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chat_message_changed')
    CREATE INDEX ix_chat_message_changed ON app.chat_message (chat_id, changed_at) WHERE changed_at IS NOT NULL;
GO
