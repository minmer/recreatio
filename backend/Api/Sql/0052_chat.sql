/*
    ROZMOWY — auf dem Kern der Bereiche.

    Wunsch der Kanzlei (2026-09-28): ein Chat fuer einen BESTEHENDEN Bereich,
    oder einer ohne Gruppe — zu zweit (zwei Personen oder Rollen) oder als
    Gruppe. Und: der Zugang zum Chat IST der Zugang zum Bereich. Dieselbe
    Datenbank, derselbe Dienst; nur zwei Wege, Menschen hineinzunehmen — ueber
    den Bereich oder ueber die Einstellungen des Chats.

    Deshalb liegt JEDER Chat an einem Bereich:

        area     ein bestehender Bereich bekommt seinen Chat
        group    der Browser legt fuer die Gruppe einen Bereich an
        direct   zu zweit — ebenfalls mit eigenem Bereich, zwei Mitglieder

    Wer lesen darf: wer den Bereich lesen darf (ein Zertifikat read, write,
    admin). Wer schreiben darf: eine Rolle, die selbst ein Zertifikat write
    oder admin auf dem Bereich traegt. Wer hineinlaesst oder hinausnimmt: wer
    dort certify (oder admin) hat — wie in jedem Bereich.

    Der Dienst liest keine Nachricht: sie liegt unter dem Epochenschluessel
    des Bereichs, und jede Fassung ist von der Rolle ihres Verfassers
    unterschrieben (Kernel.MessageVersionRecord). Er prueft die Unterschrift,
    er kann sie nicht faelschen.

    area_member_name: wie jemand in diesem Bereich heisst — versiegelt unter
    dem Bereichsschluessel, also nur fuer seine Mitglieder lesbar. Ohne das
    stuende an jeder fremden Nachricht nur eine Kennung: die Namen der Rollen
    liegen unter ihren eigenen Schluesseln.
*/

IF OBJECT_ID('app.chat') IS NULL
    CREATE TABLE app.chat
    (
        id                 uniqueidentifier  NOT NULL,
        area_id            uniqueidentifier  NOT NULL,
        kind               nvarchar(8)       NOT NULL,

        /* Zu zweit: die beiden Rollen, sortiert, durch „|" — damit es jede Rozmowa nur einmal gibt. */
        pair_key           nvarchar(80)      NULL,

        created_by_role_id uniqueidentifier  NOT NULL,
        created_at         datetimeoffset(7) NOT NULL,
        last_message_at    datetimeoffset(7) NULL,

        CONSTRAINT pk_chat PRIMARY KEY (id),
        CONSTRAINT fk_chat_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_chat_creator FOREIGN KEY (created_by_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_chat_kind CHECK (kind IN (N'area', N'group', N'direct')),
        CONSTRAINT ck_chat_pair CHECK ((kind = N'direct' AND pair_key IS NOT NULL)
                                    OR (kind <> N'direct' AND pair_key IS NULL))
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_area')
    CREATE UNIQUE INDEX uq_chat_area ON app.chat (area_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_pair')
    CREATE UNIQUE INDEX uq_chat_pair ON app.chat (pair_key) WHERE pair_key IS NOT NULL;
GO

IF OBJECT_ID('app.chat_message') IS NULL
    CREATE TABLE app.chat_message
    (
        id             uniqueidentifier  NOT NULL,
        chat_id        uniqueidentifier  NOT NULL,
        author_role_id uniqueidentifier  NOT NULL,

        /* Unter welcher Epoche des Bereichs — und die Huelle selbst; NULL: geloescht. */
        epoch          int               NOT NULL,
        body_sealed    varbinary(max)    NULL,
        body_sha256    varbinary(32)     NOT NULL,

        /* Die Unterschrift des Verfassers ueber MessageVersionRecord (Version 1). */
        signature      varbinary(1024)   NOT NULL,
        signed_at      datetimeoffset(7) NOT NULL,

        created_at     datetimeoffset(7) NOT NULL,
        deleted_at     datetimeoffset(7) NULL,

        CONSTRAINT pk_chat_message PRIMARY KEY (id),
        CONSTRAINT fk_chat_message_chat FOREIGN KEY (chat_id) REFERENCES app.chat (id),
        CONSTRAINT fk_chat_message_author FOREIGN KEY (author_role_id) REFERENCES app.role (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_chat_message_chat')
    CREATE INDEX ix_chat_message_chat ON app.chat_message (chat_id, created_at);
GO

/* Bis wann ein Konto gelesen hat — fuer „nowe wiadomości". */
IF OBJECT_ID('app.chat_read') IS NULL
    CREATE TABLE app.chat_read
    (
        chat_id    uniqueidentifier  NOT NULL,
        account_id uniqueidentifier  NOT NULL,
        read_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_chat_read PRIMARY KEY (chat_id, account_id),
        CONSTRAINT fk_chat_read_chat FOREIGN KEY (chat_id) REFERENCES app.chat (id),
        CONSTRAINT fk_chat_read_account FOREIGN KEY (account_id) REFERENCES app.account (id)
    );
GO

IF OBJECT_ID('app.area_member_name') IS NULL
    CREATE TABLE app.area_member_name
    (
        area_id        uniqueidentifier  NOT NULL,
        role_id        uniqueidentifier  NOT NULL,
        name_sealed    varbinary(1024)   NOT NULL,
        epoch          int               NOT NULL,
        set_by_role_id uniqueidentifier  NOT NULL,
        updated_at     datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_area_member_name PRIMARY KEY (area_id, role_id),
        CONSTRAINT fk_area_member_name_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_area_member_name_role FOREIGN KEY (role_id) REFERENCES app.role (id)
    );
GO
