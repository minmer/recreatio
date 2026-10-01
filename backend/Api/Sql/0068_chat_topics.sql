/*
    TEMATY W ROZMOWIE (0068) — eine Rozmowa, mehrere Fäden.

    `app.topic` steht seit 0004 bereit und war bisher unbenutzt: ein Thema
    am Bereich, mit versiegeltem Titel, offen oder geschlossen. Hier bekommt
    es, was eine Rozmowa braucht:

        chat_id             in welcher Rozmowa (ein Bereich kann mehr als eine
                            haben, seit 0069 jeder Platz seine eigene)
        created_by_role_id  wer es aufgemacht hat — eine Rolle; Plätze legen
        created_by_access_id  ihre Themen auch an (sie schreiben ja mit)
        last_message_at     für die Reihenfolge in der Liste

    Der TITEL liegt unter dem SCHLÜSSEL DER ROZMOWA (abgeleitet wie für ihre
    Nachrichten), nicht unter dem des Bereichs: sonst könnte ein Platz, der
    nur den Chatschlüssel hält, die Themen seiner eigenen Rozmowa nicht lesen.

    Eine Nachricht gehört zu höchstens EINEM Thema (`chat_message.topic_id`).
    Die alte Zuordnung `topic_message` (viele zu vielen, an `app.message`)
    bleibt unberührt — sie gehört zum Altbestand.

    An Thema und Rozmowa hängen Aufgaben (0066) und Termine
    (`calendar_item.topic_id` seit 0004, `chat_id` ab 0070) — ohne
    Fremdschlüssel, damit eine verschwundene Rozmowa niemandem den Termin nimmt.
*/

IF COL_LENGTH('app.topic', 'chat_id') IS NULL
    ALTER TABLE app.topic ADD chat_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.topic', 'created_by_role_id') IS NULL
    ALTER TABLE app.topic ADD created_by_role_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.topic', 'created_by_access_id') IS NULL
    ALTER TABLE app.topic ADD created_by_access_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.topic', 'last_message_at') IS NULL
    ALTER TABLE app.topic ADD last_message_at datetimeoffset NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_topic_chat')
    ALTER TABLE app.topic ADD CONSTRAINT fk_topic_chat FOREIGN KEY (chat_id) REFERENCES app.chat (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_topic_role')
    ALTER TABLE app.topic ADD CONSTRAINT fk_topic_role FOREIGN KEY (created_by_role_id) REFERENCES app.role (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_topic_access')
    ALTER TABLE app.topic ADD CONSTRAINT fk_topic_access FOREIGN KEY (created_by_access_id) REFERENCES app.access (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_topic_chat')
    CREATE INDEX ix_topic_chat ON app.topic (chat_id, closed_at) WHERE chat_id IS NOT NULL;
GO

IF COL_LENGTH('app.chat_message', 'topic_id') IS NULL
    ALTER TABLE app.chat_message ADD topic_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_chat_message_topic')
    ALTER TABLE app.chat_message ADD CONSTRAINT fk_chat_message_topic FOREIGN KEY (topic_id) REFERENCES app.topic (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chat_message_topic')
    CREATE INDEX ix_chat_message_topic ON app.chat_message (topic_id, created_at) WHERE topic_id IS NOT NULL;
GO
