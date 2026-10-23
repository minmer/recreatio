/*
    0126 — DOSTĘP DLA AI (2026-10-24): ein ausdrücklicher Link, über den ein
    Assistent (ChatGPT, Claude …) die drei Teile EINES Bereichs liest —
    Bibliothek, Skryptorium, Bazy wiedzy — und nichts sonst. Nur lesen.

    Angelegt wird er von dem, der den Bereich prowadzi, mit den Behältern, die
    er wählt. Der Dienst würfelt das Geheimnis (`Kernel.Token`), gibt es EINMAL
    heraus und behält nur seinen Hash.

    WAS DER DIENST HÄLT — und warum er trotzdem nichts liest:
      key_wrapped   ein Zufallsschlüssel C, verpackt unter HKDF(Geheimnis) —
                    aufzumachen nur mit dem Link, den der Dienst nicht hat
      key_sealed    derselbe C unter dem Schlüssel des Bereichs: wer dort
                    schreibt, frischt die Abschriften auf, ohne den Link zu kennen
      token_sealed  das Geheimnis unter dem Schlüssel des Bereichs: wer
                    prowadzi, kopiert den Link später noch einmal
      key_id        die Kennung von C (21.5) — eine hochgeladene Abschrift muss
                    unter genau diesem Schlüssel liegen
    Je Behälter eine ABSCHRIFT (`app.ai_access_part.snapshot`), im Browser
    gebaut und unter C versiegelt. Geöffnet wird sie nur während einer Anfrage,
    die den Link trägt — das ist die eine, ausdrückliche Ausnahme von „der
    Dienst öffnet nichts" (ARCHITECTURE.md).

    `mark` sagt, aus welchem Stand des Behälters die Abschrift gebaut wurde;
    weicht der heutige ab, frischt der nächste Schreibende sie auf.

    Gelöscht wird mit dem Bereich und mit dem Behälter (ON DELETE CASCADE —
    eine Abschrift überlebt nie, wovon sie abgeschrieben ist). Wer ihn
    anlegte, steht ohne Fremdschlüssel da: gilt sein Recht im Bereich nicht
    mehr (oder ist sein Konto fort), antwortet der Link nicht mehr.

    Keine Daten eines Benutzers werden verändert; noch einmal ausgeführt,
    ändert es nichts.
*/

IF OBJECT_ID('app.ai_access', 'U') IS NULL
    CREATE TABLE app.ai_access
    (
        id            uniqueidentifier  NOT NULL,
        area_id       uniqueidentifier  NOT NULL,
        account_id    uniqueidentifier  NOT NULL,
        token_sha256  varbinary(32)     NOT NULL,
        epoch         int               NULL,
        key_sealed    varbinary(400)    NULL,
        token_sealed  varbinary(400)    NULL,
        key_wrapped   varbinary(400)    NULL,
        key_id        varbinary(16)     NULL,
        created_at    datetimeoffset(7) NOT NULL,
        expires_at    datetimeoffset(7) NOT NULL,
        last_used_at  datetimeoffset(7) NULL,
        uses          int               NOT NULL CONSTRAINT df_ai_access_uses DEFAULT (0),
        CONSTRAINT pk_ai_access PRIMARY KEY (id),
        CONSTRAINT fk_ai_access_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE,
        CONSTRAINT ck_ai_access_token CHECK (DATALENGTH(token_sha256) = 32),
        CONSTRAINT ck_ai_access_epoch CHECK (epoch IS NULL OR epoch >= 1),
        /* Fertig heisst: alles da — oder (noch) nichts davon. */
        CONSTRAINT ck_ai_access_ready CHECK (
            (key_wrapped IS NULL AND key_sealed IS NULL AND token_sealed IS NULL AND key_id IS NULL AND epoch IS NULL)
         OR (key_wrapped IS NOT NULL AND key_sealed IS NOT NULL AND token_sealed IS NOT NULL AND DATALENGTH(key_id) = 16 AND epoch IS NOT NULL))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_ai_access_token')
    CREATE UNIQUE INDEX ux_ai_access_token ON app.ai_access (token_sha256);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ai_access_area')
    CREATE INDEX ix_ai_access_area ON app.ai_access (area_id, created_at);
GO

IF OBJECT_ID('app.ai_access_part', 'U') IS NULL
    CREATE TABLE app.ai_access_part
    (
        access_id   uniqueidentifier  NOT NULL,
        library_id  uniqueidentifier  NOT NULL,
        snapshot    varbinary(max)    NULL,
        mark        varchar(120)      NULL,
        entries     int               NULL,
        made_at     datetimeoffset(7) NULL,
        CONSTRAINT pk_ai_access_part PRIMARY KEY (access_id, library_id),
        CONSTRAINT fk_ai_access_part_access FOREIGN KEY (access_id) REFERENCES app.ai_access (id) ON DELETE CASCADE,
        CONSTRAINT fk_ai_access_part_library FOREIGN KEY (library_id) REFERENCES app.library (id) ON DELETE CASCADE
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ai_access_part_library')
    CREATE INDEX ix_ai_access_part_library ON app.ai_access_part (library_id);
GO
