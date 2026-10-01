/*
    POWIADOMIENIA (0067) — was neu ist, ohne den Akku leerzusaugen.

    Der Browser fragt selbst, und zwar sparsam: sichtbar jede Minute, im
    Hintergrund alle fünf, bei schwachem Akku seltener, ohne Netz gar nicht
    (`notify.ts`). Gefragt wird nach ZAHLEN — wie viele ungelesene
    Nachrichten, neue Anmeldungen, eingelöste Links —, nie nach Inhalten:
    die liegen versiegelt und gingen ohnehin nur im Browser auf.

    Die App auf dem Telefon fragt auch, wenn sie geschlossen ist: ein Arbeiter
    des Systems (Android WorkManager), höchstens alle 15 Minuten und nur mit
    Netz. Er hat kein Sitzungscookie — deshalb ein GERÄT: ein Zufallswert, den
    die App bei sich hält; hier liegt nur sein Abdruck. Er öffnet nichts als
    die Zahlen dieses Kontos und lässt sich jederzeit zurückziehen (Abmelden
    zieht ihn mit zurück).
*/

IF OBJECT_ID('app.notify_device') IS NULL
    CREATE TABLE app.notify_device
    (
        id            uniqueidentifier  NOT NULL,
        account_id    uniqueidentifier  NOT NULL,
        token_sha256  varbinary(32)     NOT NULL,
        label         nvarchar(100)     NULL,
        platform      nvarchar(16)      NOT NULL,
        created_at    datetimeoffset(7) NOT NULL,
        last_seen_at  datetimeoffset(7) NULL,
        revoked_at    datetimeoffset(7) NULL,

        CONSTRAINT pk_notify_device PRIMARY KEY (id),
        CONSTRAINT fk_notify_device_account FOREIGN KEY (account_id) REFERENCES app.account (id),
        CONSTRAINT ck_notify_device_platform CHECK (platform IN (N'android', N'web'))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_notify_device_token')
    CREATE UNIQUE INDEX ux_notify_device_token ON app.notify_device (token_sha256);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_notify_device_account')
    CREATE INDEX ix_notify_device_account ON app.notify_device (account_id) WHERE revoked_at IS NULL;
GO

/* Schnell zählen, was seit einem Zeitpunkt eingegangen ist. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_submitted')
    CREATE INDEX ix_registration_submitted ON app.registration (submitted_at) INCLUDE (part_id, is_hidden, withdrawn_at);
GO
