/* 0114 — DAS TELEFON: Kontakte und das Archiv der SMS, versiegelt unter dem
   Schlüssel eines Bereichs (gedacht: des eigenen, „Tylko ja").

   1. `app.phone_contact` — EIN Kontakt je Zeile (Name, Nummern, E-Mails,
      Organisation, Notiz) als eine Hülle. `version` zählt jede Änderung:
      wer mit einem alten Stand speichert, wird abgewiesen. Gelöscht heisst
      Grabstein (ohne Hülle), damit ein Telefon beim Abgleich davon erfährt.
   2. `app.phone_sms_batch` — ein STAPEL archivierter Nachrichten (SMS und
      MMS) als eine Hülle; nur angehängt, nie geändert. Daneben offen nur die
      Abdrücke der Nachrichten (`message_keys`: je 16 Bytes, aus einem
      Schlüssel, den der Dienst nicht hat) — damit ein Telefon, das neu
      archiviert, nichts doppelt schickt, ohne dass hier jemand mitliest.
   3. `app.phone_file` — Bilder und Filme aus MMS, als versiegelte Dateien
      neben der Datenbank (Phone:FileDirectory), hier nur, was zu ihnen gehört.

   Der Dienst öffnet keine dieser Hüllen. Die Datenbank ist klein bemessen:
   Dateien kommen nie hinein, und ein Bereich bekommt höchstens 100 MB Archiv.
*/
IF OBJECT_ID('app.phone_contact', 'U') IS NULL
    CREATE TABLE app.phone_contact
    (
        id          uniqueidentifier  NOT NULL,
        area_id     uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        /* NULL: gelöscht (Grabstein für den Abgleich). */
        sealed      varbinary(max)    NULL,
        version     int               NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        updated_at  datetimeoffset(7) NOT NULL,
        deleted_at  datetimeoffset(7) NULL,
        CONSTRAINT pk_phone_contact PRIMARY KEY (id),
        CONSTRAINT fk_phone_contact_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_contact_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_contact_version CHECK (version >= 1),
        CONSTRAINT ck_phone_contact_sealed CHECK ((deleted_at IS NULL AND sealed IS NOT NULL) OR (deleted_at IS NOT NULL AND sealed IS NULL))
    );
GO

/* Der Abgleich: was sich in diesem Bereich seit … geändert hat. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_contact_sync')
    CREATE INDEX ix_phone_contact_sync ON app.phone_contact (area_id, updated_at);
GO

IF OBJECT_ID('app.phone_sms_batch', 'U') IS NULL
    CREATE TABLE app.phone_sms_batch
    (
        id            uniqueidentifier  NOT NULL,
        area_id       uniqueidentifier  NOT NULL,
        epoch         int               NOT NULL,
        sealed        varbinary(max)    NOT NULL,
        /* Je Nachricht 16 Bytes — ein Abdruck, kein Inhalt. */
        message_keys  varbinary(max)    NOT NULL,
        message_count int               NOT NULL,
        created_at    datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_phone_sms_batch PRIMARY KEY (id),
        CONSTRAINT fk_phone_sms_batch_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_sms_batch_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_sms_batch_count CHECK (message_count BETWEEN 1 AND 5000),
        CONSTRAINT ck_phone_sms_batch_keys CHECK (DATALENGTH(message_keys) = 16 * message_count)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_sms_batch_area')
    CREATE INDEX ix_phone_sms_batch_area ON app.phone_sms_batch (area_id, created_at);
GO

IF OBJECT_ID('app.phone_file', 'U') IS NULL
    CREATE TABLE app.phone_file
    (
        id          uniqueidentifier  NOT NULL,
        area_id     uniqueidentifier  NOT NULL,
        epoch       int               NOT NULL,
        byte_length bigint            NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_phone_file PRIMARY KEY (id),
        CONSTRAINT fk_phone_file_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_file_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_file_length CHECK (byte_length BETWEEN 1 AND 26214400)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_file_area')
    CREATE INDEX ix_phone_file_area ON app.phone_file (area_id, created_at);
GO
