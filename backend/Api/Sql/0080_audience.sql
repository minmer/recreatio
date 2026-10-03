/*
    DIE DREI ZUGÄNGE (0080) — Kanał, gemeinsam, einer mit einem.

    -------------------------------------------------------------------------
    WAS GEWÜNSCHT WAR
    -------------------------------------------------------------------------

      1. KANAŁ — der Bereich schreibt, die anderen hören zu; auch die
         Menschen aus Formularen.
      2. EINER MIT EINEM — ein Bereich (etwa der, der das Formular führt)
         und EINE Person aus dem Formular.
      3. GEMEINSAM — alle zusammen, jeder schreibt.

    „Das ist eine allgemeine Lage, die auch für andere Dinge gilt." Deshalb
    ist das hier kein Merkmal der Rozmowa, sondern eines von allem, was ein
    Bereich hält (`Audience.cs`). Die Rozmowa ist das erste solche Ding.

    -------------------------------------------------------------------------
    WAS DAFÜR FEHLTE
    -------------------------------------------------------------------------

    `app.audience_form` — welche Formulare an einem Ding hängen. Wer eines
    davon ausgefüllt hat (nicht zurückgezogen, nicht ausgeblendet), gehört
    zu dessen Menschen, neben den Plätzen des Bereichs selbst. Wie
    `app.certificate` (scope_kind, scope_id) zeigt die Zeile auf ihr Ding
    über Art und Kennung; ein neues Ding erweitert `ck_audience_kind`.

    Für die Rozmowa:
      - Ein Kanał war bisher eine Rozmowa des Bereichs mit `posting_policy =
        writers`, und ein Bereich hatte nur EINE eigene Rozmowa
        (`uq_chat_area`). Jetzt ist der Kanał eine eigene Art, `channel`: je
        Bereich einer, neben der einen Rozmowa (`area`).
      - Die Rozmowa mit einem Platz (0069) lag am Bereich DES PLATZES. Jetzt
        an jedem Bereich, der mit ihm zu tun hat — je Platz und Bereich eine
        (`uq_chat_seat`).

    -------------------------------------------------------------------------
    WAS MIT DEM BESTEHENDEN GESCHIEHT
    -------------------------------------------------------------------------

    Eine Rozmowa des Bereichs mit `writers` IST ein Kanał — sie wird einer
    (sofern der Bereich noch keinen hat). Wer schreibt und wer liest, ändert
    sich dadurch nicht.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'ck_chat_kind' AND parent_object_id = OBJECT_ID('app.chat') AND definition NOT LIKE '%channel%')
    ALTER TABLE app.chat DROP CONSTRAINT ck_chat_kind;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_kind' AND parent_object_id = OBJECT_ID('app.chat'))
    ALTER TABLE app.chat ADD CONSTRAINT ck_chat_kind CHECK (kind IN (N'area', N'channel', N'group', N'direct', N'self', N'seat'));
GO

/* Ein Bereich: eine Rozmowa und ein Kanał — die mit Plätzen nicht mitgezählt. */
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_area' AND object_id = OBJECT_ID('app.chat')
           AND filter_definition NOT LIKE '%channel%')
    DROP INDEX uq_chat_area ON app.chat;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_area' AND object_id = OBJECT_ID('app.chat'))
    CREATE UNIQUE INDEX uq_chat_area ON app.chat (area_id) WHERE seat_id IS NULL AND kind <> N'channel';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_channel' AND object_id = OBJECT_ID('app.chat'))
    CREATE UNIQUE INDEX uq_chat_channel ON app.chat (area_id) WHERE kind = N'channel';
GO

/* Die Rozmowa mit einem Platz: je Platz und Bereich eine. */
IF EXISTS (SELECT 1 FROM sys.indexes i
           WHERE i.name = 'uq_chat_seat' AND i.object_id = OBJECT_ID('app.chat')
             AND (SELECT COUNT(*) FROM sys.index_columns c WHERE c.object_id = i.object_id AND c.index_id = i.index_id) = 1)
    DROP INDEX uq_chat_seat ON app.chat;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_chat_seat' AND object_id = OBJECT_ID('app.chat'))
    CREATE UNIQUE INDEX uq_chat_seat ON app.chat (seat_id, area_id) WHERE seat_id IS NOT NULL;
GO

/* Welche Formulare an einem Ding hängen — und damit, wer außer dem Bereich dazugehört. */
IF OBJECT_ID('app.audience_form', 'U') IS NULL
    CREATE TABLE app.audience_form
    (
        subject_kind     nvarchar(16)     NOT NULL,
        subject_id       uniqueidentifier NOT NULL,
        module_id        uniqueidentifier NOT NULL,
        added_by_role_id uniqueidentifier NOT NULL,
        added_at         datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_audience_form PRIMARY KEY (subject_kind, subject_id, module_id),
        CONSTRAINT ck_audience_kind CHECK (subject_kind IN (N'chat')),
        CONSTRAINT fk_audience_form_module FOREIGN KEY (module_id) REFERENCES app.module (id),
        CONSTRAINT fk_audience_form_role FOREIGN KEY (added_by_role_id) REFERENCES app.role (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_audience_form_module' AND object_id = OBJECT_ID('app.audience_form'))
    CREATE INDEX ix_audience_form_module ON app.audience_form (module_id);
GO

/* Die Rozmowa eines Bereichs, in der nur die Schreibenden schreiben, ist ein Kanał. */
UPDATE app.chat SET kind = N'channel'
WHERE kind = N'area' AND posting_policy = N'writers'
  AND NOT EXISTS (SELECT 1 FROM app.chat x WHERE x.area_id = app.chat.area_id AND x.kind = N'channel');
GO
