/* 0117 — PLIKI PRZEZ LINK (zu 0114).

   Ein Zdjęcie in voller Grösse, ein Film, ein PDF: statt einer MMS, die der
   Betreiber auf ein paar hundert KB drückt, geht eine SMS mit einem Link
   hinaus — `https://recreatio.pl/#/plik/<geheimnis>`.

   Versiegelt wird im Browser des Absenders. Aus dem Geheimnis des Links folgen
   die Kennung (die der Dienst sieht) und der Schlüssel (den er nie sieht) —
   mit verschiedenen Etiketten, eines lässt nicht auf das andere schliessen.
   Hier steht nur, was zum Lauf gehört: welcher Bereich ihn teilt (und ihn
   zurückziehen darf), wie gross, bis wann; daneben ein versiegeltes Etikett
   für den Absender (Name, Art, das Geheimnis, an wen) — offen ist nichts davon.

   Die Datei selbst liegt neben den Dateien des Telefons (Phone:FileDirectory,
   Ordner des Bereichs), nie in der Datenbank. Nach dem Ablauf ist sie fort.
*/
IF OBJECT_ID('app.phone_share', 'U') IS NULL
    CREATE TABLE app.phone_share
    (
        id               uniqueidentifier  NOT NULL,
        area_id          uniqueidentifier  NOT NULL,
        epoch            int               NOT NULL,
        label            varbinary(4000)   NOT NULL,
        byte_length      bigint            NOT NULL,
        created_at       datetimeoffset(7) NOT NULL,
        expires_at       datetimeoffset(7) NOT NULL,
        /* Zurückgezogen oder abgelaufen und fortgeräumt — die Datei ist dann nicht mehr da. */
        deleted_at       datetimeoffset(7) NULL,
        downloads        int               NOT NULL CONSTRAINT df_phone_share_downloads DEFAULT (0),
        last_download_at datetimeoffset(7) NULL,
        CONSTRAINT pk_phone_share PRIMARY KEY (id),
        CONSTRAINT fk_phone_share_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_phone_share_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_share_length CHECK (byte_length BETWEEN 32 AND 26279936)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_share_area')
    CREATE INDEX ix_phone_share_area ON app.phone_share (area_id, deleted_at, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_share_expires')
    CREATE INDEX ix_phone_share_expires ON app.phone_share (expires_at) WHERE deleted_at IS NULL;
GO
