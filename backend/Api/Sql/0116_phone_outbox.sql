/* 0116 — WAS DAS TELEFON SENDEN SOLL (zu 0114/0115).

   Im Browser schreibt man auf eine archivierte SMS zurück — oder plant eine
   Nachricht für später; senden kann nur das Telefon, das die Nummer hat, von
   der die Rozmowa läuft. Bis es sie holt, steht sie hier: versiegelt unter dem
   Schlüssel des Bereichs des Archivs (an wen, was, wann, von welcher eigenen
   Nummer — nichts davon offen).

   Offen ist nur der Lauf: `waiting` (wartet auf ein Telefon) → `taken` (ein
   Telefon hat sie übernommen und sendet sie zur Zeit) → `sent` | `failed`;
   `cancelled`, solange sie noch nicht gesendet ist. Hatte ein Telefon sie schon
   übernommen, bestätigt es das Absagen (`closed_at`) — bis dahin weckt der
   Dienst es deswegen.
*/
IF OBJECT_ID('app.phone_outbox', 'U') IS NULL
    CREATE TABLE app.phone_outbox
    (
        id           uniqueidentifier  NOT NULL,
        area_id      uniqueidentifier  NOT NULL,
        epoch        int               NOT NULL,
        sealed       varbinary(max)    NOT NULL,
        state        nvarchar(10)      NOT NULL,
        /* Welches Telefon sie übernahm — wie es sich nennt („Pixel 8"), nichts weiter. */
        device       nvarchar(80)      NULL,
        error        nvarchar(200)     NULL,
        created_at   datetimeoffset(7) NOT NULL,
        taken_at     datetimeoffset(7) NULL,
        done_at      datetimeoffset(7) NULL,
        cancelled_at datetimeoffset(7) NULL,
        closed_at    datetimeoffset(7) NULL,
        CONSTRAINT pk_phone_outbox PRIMARY KEY (id),
        CONSTRAINT fk_phone_outbox_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_outbox_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_outbox_state CHECK (state IN (N'waiting', N'taken', N'sent', N'failed', N'cancelled'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_outbox_area')
    CREATE INDEX ix_phone_outbox_area ON app.phone_outbox (area_id, state, created_at);
GO
