/* 0125 — PLIKI PRZEZ LINK AUS DEM POSTPROGRAMM (zu 0117).

   Thunderbird (der Dodatek `frontend/thunderbird`) legt grosse Anhänge als
   Pliki przez link ab — dieselbe Hülle, derselbe Link `#/plik/<geheimnis>` wie
   aus einer SMS. Ein Konto meldet er dafür NICHT an: er hält ein Połączenie,
   das im Browser des Kontos entsteht (Pliki przez link → Thunderbird) und genau
   eines kann — Dateien in diesen Bereich legen und die eigenen zurückziehen.
   Lesen kann er dort nichts.

   Was das Połączenie ausmacht:
     token_sha256  das Geheimnis, mit dem er sich ausweist — nur gehasht, wie eine Sitzung
     sealed        unter dem Schlüssel des Bereichs: der Schlüssel seiner Etiketten und
                   sein Name; offen ist nichts davon
     account_id    wer ihn verbunden hat — dessen Recht im Bereich gilt bei jedem Hinauf
   Zurückgezogen (`revoked_at`) weist er sich nicht mehr aus; was er schon geteilt
   hat, bleibt bis zu seinem Ablauf, mit `device_id` an der Zeile des Links.
*/
IF OBJECT_ID('app.phone_share_device', 'U') IS NULL
    CREATE TABLE app.phone_share_device
    (
        id           uniqueidentifier  NOT NULL,
        area_id      uniqueidentifier  NOT NULL,
        account_id   uniqueidentifier  NOT NULL,
        token_sha256 varbinary(32)     NOT NULL,
        epoch        int               NOT NULL,
        sealed       varbinary(2000)   NOT NULL,
        created_at   datetimeoffset(7) NOT NULL,
        last_used_at datetimeoffset(7) NULL,
        revoked_at   datetimeoffset(7) NULL,
        CONSTRAINT pk_phone_share_device PRIMARY KEY (id),
        CONSTRAINT fk_phone_share_device_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_phone_share_device_account FOREIGN KEY (account_id) REFERENCES app.account (id),
        CONSTRAINT ck_phone_share_device_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_phone_share_device_token CHECK (DATALENGTH(token_sha256) = 32)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_phone_share_device_token')
    CREATE UNIQUE INDEX ux_phone_share_device_token ON app.phone_share_device (token_sha256);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_share_device_area')
    CREATE INDEX ix_phone_share_device_area ON app.phone_share_device (area_id, revoked_at, created_at);
GO

/* Welches Połączenie einen Link anlegte — sein Etikett liegt dann unter dessen Schlüssel. */
IF COL_LENGTH('app.phone_share', 'device_id') IS NULL
    ALTER TABLE app.phone_share ADD device_id uniqueidentifier NULL
        CONSTRAINT fk_phone_share_device REFERENCES app.phone_share_device (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_phone_share_device_id')
    CREATE INDEX ix_phone_share_device_id ON app.phone_share (device_id) WHERE device_id IS NOT NULL;
GO
