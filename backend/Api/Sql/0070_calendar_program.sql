/*
    PROGRAM WYDARZENIA (0070) — Termine in Terminen.

    Ein Wydarzenie hat Teile: Rekolekcje mit Konferenzen, eine Pielgrzymka
    mit Etappen, ein Festyn mit Punkten. Jeder Teil ist ein eigener Termin —
    mit eigener Zeit, eigenem Ort, eigener Notiz, eigener Sichtbarkeit —,
    der weiss, zu welchem größeren er gehört (`parent_item_id`), und an
    welcher Stelle (`position`; ohne sie zählt die Zeit). Tiefer geht es
    auch: ein Tag der Rekolekcje hat seine Punkte.

    Der Baustein „program" auf einer Seite zeigt einen Termin mit allem, was
    darunter hängt; der Kalender zeigt die Teile als gewöhnliche Termine und
    sagt, wozu sie gehören.

    `chat_id`: aus welcher Rozmowa ein Termin entstand (neben `topic_id` aus
    0004) — ohne Fremdschlüssel, aus demselben Grund wie dort.
*/

IF COL_LENGTH('app.calendar_item', 'parent_item_id') IS NULL
    ALTER TABLE app.calendar_item ADD parent_item_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.calendar_item', 'position') IS NULL
    ALTER TABLE app.calendar_item ADD position int NULL;
GO

IF COL_LENGTH('app.calendar_item', 'chat_id') IS NULL
    ALTER TABLE app.calendar_item ADD chat_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_item_parent')
    ALTER TABLE app.calendar_item ADD CONSTRAINT fk_item_parent FOREIGN KEY (parent_item_id) REFERENCES app.calendar_item (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_parent_self')
    ALTER TABLE app.calendar_item ADD CONSTRAINT ck_item_parent_self CHECK (parent_item_id IS NULL OR parent_item_id <> id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_parent')
    CREATE INDEX ix_item_parent ON app.calendar_item (parent_item_id, position) WHERE parent_item_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_chat')
    CREATE INDEX ix_item_chat ON app.calendar_item (chat_id, topic_id) WHERE chat_id IS NOT NULL;
GO
