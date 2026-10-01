/*
    ROZMOWA Z OSOBĄ Z FORMULARZA (0069) — `chat.kind = 'seat'`.

    Wer ein Formular ausfüllt, bekommt einen PLATZ (0022): einen Link ohne
    Konto. Bisher konnte er nur in der Rozmowa des ganzen Bereichs
    mitschreiben (0053) — dort lesen aber alle anderen Plätze mit, und wer
    der Kanzlei etwas über seine Anmeldung schreibt, schreibt es nicht allen,
    die sich auch angemeldet haben.

    Deshalb eine Rozmowa JE PLATZ: am Bereich des Platzes (wer ihn liest,
    liest mit, wie immer), mit `seat_id` an genau diesem einen Platz. Ihr
    Schlüssel ist abgeleitet wie jeder Chatschlüssel (`recreatio:v1:chat:<id>:<epoch>`)
    und geht nur an DIESEN Platz — andere Plätze desselben Bereichs bekommen
    ihn nicht und sehen die Rozmowa nicht einmal in ihrer Liste.

    `uq_chat_area` galt bisher für jede Rozmowa („ein Bereich, ein Chat");
    jetzt gilt es für alle außer diesen — ein Bereich hat eine eigene Rozmowa
    und daneben so viele mit Plätzen, wie es Plätze gibt.
*/

IF COL_LENGTH('app.chat', 'seat_id') IS NULL
    ALTER TABLE app.chat ADD seat_id uniqueidentifier NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_chat_seat')
    ALTER TABLE app.chat ADD CONSTRAINT fk_chat_seat FOREIGN KEY (seat_id) REFERENCES app.access (id);
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_kind' AND parent_object_id = OBJECT_ID('app.chat'))
    ALTER TABLE app.chat DROP CONSTRAINT ck_chat_kind;
GO
ALTER TABLE app.chat ADD CONSTRAINT ck_chat_kind CHECK (kind IN (N'area', N'group', N'direct', N'self', N'seat'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_seat')
    ALTER TABLE app.chat ADD CONSTRAINT ck_chat_seat CHECK ((kind = N'seat' AND seat_id IS NOT NULL) OR (kind <> N'seat' AND seat_id IS NULL));
GO

/* Ein Bereich, eine eigene Rozmowa — die mit den Plätzen nicht mitgezählt. */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_area' AND object_id = OBJECT_ID('app.chat') AND has_filter = 0)
    DROP INDEX uq_chat_area ON app.chat;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_area')
    CREATE UNIQUE INDEX uq_chat_area ON app.chat (area_id) WHERE seat_id IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_seat')
    CREATE UNIQUE INDEX uq_chat_seat ON app.chat (seat_id) WHERE seat_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chat_area_all')
    CREATE INDEX ix_chat_area_all ON app.chat (area_id, kind);
GO
