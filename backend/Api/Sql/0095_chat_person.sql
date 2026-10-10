/*
    IN EINER ROZMOWA SPRICHT EINE PERSON (0095) — mit Vor- und Nachnamen, und
    wenn sie über eine Rolle hereinkommt, die keine Person ist, steht die Rolle
    in Klammern daneben: „Anna Nowak (Rada parafialna)".

    `chat_message.author_person_id`: WER durch die Rolle spricht. Unterschrieben
    wird weiter mit der Rolle (`author_role_id`, MessageVersionRecord
    unverändert); dass die Person zum Konto gehört und die Rolle hält, prüft
    der Dienst beim Schreiben. Ist die Rolle selbst eine Person, steht sie hier
    noch einmal. NULL: eine Nachricht von vorher.

    `access.invitation_id` und `origin = 'link'`: DIE PERSON EINES LINKS. Wer
    mit einem Link mit Zugang (0065/0091) ohne Konto da ist, stellt sich vor
    (Imię, Nazwisko) und wird ein Platz — wie ein Mensch aus einem Formular,
    nur dass sein Platz am Link hängt und die Linkrolle hält
    (`access_role`, 0091). So hat er eine eigene Unterschrift (der Link selbst
    gehört allen, die ihn haben) und schreibt in den Rozmowy der Bereiche,
    die der Link öffnet.
*/

IF COL_LENGTH('app.chat_message', 'author_person_id') IS NULL
    ALTER TABLE app.chat_message ADD author_person_id uniqueidentifier NULL
        CONSTRAINT fk_chat_message_person FOREIGN KEY REFERENCES app.role (id);
GO

IF COL_LENGTH('app.access', 'invitation_id') IS NULL
    ALTER TABLE app.access ADD invitation_id uniqueidentifier NULL
        CONSTRAINT fk_access_invitation FOREIGN KEY REFERENCES app.invitation (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_invitation' AND object_id = OBJECT_ID('app.access'))
    CREATE INDEX ix_access_invitation ON app.access (invitation_id) WHERE invitation_id IS NOT NULL;
GO

/* Woher ein Platz kommt: selbst angemeldet, von der Kanzlei ausgestellt — oder, neu, aus einem Link. */
IF EXISTS (SELECT 1 FROM sys.check_constraints
            WHERE name = 'ck_access_origin' AND parent_object_id = OBJECT_ID('app.access')
              AND definition NOT LIKE '%link%')
    ALTER TABLE app.access DROP CONSTRAINT ck_access_origin;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_access_origin' AND parent_object_id = OBJECT_ID('app.access'))
    ALTER TABLE app.access ADD CONSTRAINT ck_access_origin CHECK (origin IN (N'self', N'office', N'link'));
GO
