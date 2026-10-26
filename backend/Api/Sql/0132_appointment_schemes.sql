/*
    SCHEMATA DER TERMINE (0132, 2026-10-26) — documentation/APPOINTMENT-SCHEMES.md.

    Ein Termin hat einen kleinen Kern; was ihn zur Messe, zum Treffen mit
    Anmeldung, zum Nabożeństwo macht, sagt sein SCHEMA. Schemata und Pläne
    liegen versiegelt am Kalender — der Dienst kennt keines davon.

      calendar_doc            Schemata (`scheme`) und Pläne (`plan`) eines
                              Kalenders, versiegelt; `version` gegen das
                              Überschreiben fremder Änderungen
      calendar_item           `scheme_id`: welches Schema (NULL: das
                              universelle, im Code); `plan_origin`: aus
                              welchem Plan, welcher Messe, welchem Tag ein
                              angelegter Termin stammt — nur damit die
                              Vorschau „schon geplant" sagen kann
      calendar_value          die Werte eines Termins nach seinem Schema: am
                              Termin (`occurrence_at` NULL) oder an einem
                              Vorkommen; versiegelt — oder offen mit
                              Beschriftung (Aushang, Gablota, Druck)
      occurrence_record       Einträge an einem Vorkommen: Intentionen,
      occurrence_record_value Anmeldungen … (je Liste des Schemas)

    DIE INTENTIONEN ZIEHEN UM: jede Zeile aus `mass_intention` wird ein
    Eintrag der Liste `intencje` (mit derselben Kennung — die Hüllen von
    Ofiarodawca und Ofiara nennen sie in ihrer AAD und gehen deshalb weiter
    auf). Kopiert, nicht gelöscht: `mass_intention` bleibt als Archiv, bis ein
    späterer Schritt es abräumt. Läuft der alte Dienst nach dieser Migration
    noch eine Weile, holt der neue beim Start nach, was er dort schrieb.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.calendar_doc', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar_doc
    (
        id                 uniqueidentifier  NOT NULL CONSTRAINT pk_calendar_doc PRIMARY KEY,
        calendar_id        uniqueidentifier  NOT NULL
                           CONSTRAINT fk_calendar_doc_calendar REFERENCES app.calendar (id) ON DELETE CASCADE,
        kind               nvarchar(10)      NOT NULL
                           CONSTRAINT ck_calendar_doc_kind CHECK (kind IN (N'scheme', N'plan')),

        /* Nur die Adresse des Schlüssels — kein Fremdschlüssel. */
        area_id            uniqueidentifier  NOT NULL,
        epoch              int               NOT NULL CONSTRAINT ck_calendar_doc_epoch CHECK (epoch >= 1),
        sealed             varbinary(max)    NOT NULL,

        version            int               NOT NULL CONSTRAINT df_calendar_doc_version DEFAULT (1),
        created_at         datetimeoffset(7) NOT NULL,
        updated_at         datetimeoffset(7) NOT NULL,
        updated_by_role_id uniqueidentifier  NULL
    );
    CREATE INDEX ix_calendar_doc_calendar ON app.calendar_doc (calendar_id, kind);
END
GO

/* Kein Fremdschlüssel auf calendar_doc: der Kalender räumte sonst auf zwei Wegen (Kaskaden) ab. */
IF COL_LENGTH('app.calendar_item', 'scheme_id') IS NULL
    ALTER TABLE app.calendar_item ADD scheme_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.calendar_item', 'plan_origin') IS NULL
    ALTER TABLE app.calendar_item ADD plan_origin nvarchar(200) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_calendar_item_origin')
    CREATE INDEX ix_calendar_item_origin ON app.calendar_item (calendar_id, plan_origin) WHERE plan_origin IS NOT NULL;
GO

IF OBJECT_ID('app.calendar_value', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar_value
    (
        id            uniqueidentifier  NOT NULL CONSTRAINT pk_calendar_value PRIMARY KEY,
        item_id       uniqueidentifier  NOT NULL
                      CONSTRAINT fk_calendar_value_item REFERENCES app.calendar_item (id) ON DELETE CASCADE,

        /* NULL: am Termin (der ganzen Reihe); sonst an diesem Vorkommen (sein ursprünglicher Beginn). */
        occurrence_at datetimeoffset(7) NULL,
        field_key     nvarchar(64)      NOT NULL,

        area_id       uniqueidentifier  NULL,
        epoch         int               NULL,
        sealed        varbinary(max)    NULL,

        /* Offen: was der Aushang zeigt — Beschriftung und Wert, wie sie dort stehen. */
        public_label  nvarchar(120)     NULL,
        public_value  nvarchar(400)     NULL,

        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT ck_calendar_value_some CHECK (sealed IS NOT NULL OR public_value IS NOT NULL),
        CONSTRAINT ck_calendar_value_sealed CHECK (
            (sealed IS NULL AND area_id IS NULL AND epoch IS NULL)
            OR (sealed IS NOT NULL AND area_id IS NOT NULL AND epoch >= 1))
    );
    CREATE UNIQUE INDEX uq_calendar_value_item ON app.calendar_value (item_id, field_key) WHERE occurrence_at IS NULL;
    CREATE UNIQUE INDEX uq_calendar_value_day ON app.calendar_value (item_id, occurrence_at, field_key) WHERE occurrence_at IS NOT NULL;
END
GO

IF OBJECT_ID('app.occurrence_record', 'U') IS NULL
BEGIN
    CREATE TABLE app.occurrence_record
    (
        id                 uniqueidentifier  NOT NULL CONSTRAINT pk_occurrence_record PRIMARY KEY,
        item_id            uniqueidentifier  NOT NULL
                           CONSTRAINT fk_occurrence_record_item REFERENCES app.calendar_item (id),
        occurrence_at      datetimeoffset(7) NOT NULL,

        /* Die Liste des Schemas: `intencje`, `zapisy` … */
        list_key           nvarchar(64)      NOT NULL,
        /* Die Art eines Eintrags, wie das Schema sie nennt (`single`, `collective` …). */
        mode               nvarchar(40)      NULL,
        ordinal            int               NOT NULL CONSTRAINT df_occurrence_record_ord DEFAULT (0),
        status             nvarchar(20)      NOT NULL CONSTRAINT df_occurrence_record_status DEFAULT (N'accepted')
                           CONSTRAINT ck_occurrence_record_status
                           CHECK (status IN (N'waiting', N'accepted', N'declined', N'cancelled', N'celebrated')),

        /* Was offen hinausgeht — die vorgelesene Intention. */
        text_public        nvarchar(400)     NULL,

        /* Der angeheftete Mensch: wer odprawia, wer sich angemeldet hat. */
        role_id            uniqueidentifier  NULL
                           CONSTRAINT fk_occurrence_record_role REFERENCES app.role (id),

        origin             nvarchar(10)      NOT NULL CONSTRAINT df_occurrence_record_origin DEFAULT (N'office')
                           CONSTRAINT ck_occurrence_record_origin CHECK (origin IN (N'office', N'outside', N'rule', N'legacy')),
        created_by_role_id uniqueidentifier  NULL,
        created_at         datetimeoffset(7) NOT NULL,
        updated_at         datetimeoffset(7) NOT NULL
    );
    CREATE INDEX ix_occurrence_record_at ON app.occurrence_record (item_id, occurrence_at, list_key, ordinal);

    /*
        Die Regel von 0018, allgemein: EIN Mensch hat an einem Vorkommen in
        einer Liste höchstens einen EINZELNEN Eintrag (zwei einzelne
        Intentionen desselben Priesters an derselben Messe gibt es nicht).
    */
    CREATE UNIQUE INDEX uq_occurrence_record_single
        ON app.occurrence_record (item_id, occurrence_at, list_key, role_id)
        WHERE mode = N'single' AND role_id IS NOT NULL AND status IN (N'accepted', N'celebrated');
END
GO

IF OBJECT_ID('app.occurrence_record_value', 'U') IS NULL
BEGIN
    CREATE TABLE app.occurrence_record_value
    (
        record_id    uniqueidentifier  NOT NULL
                     CONSTRAINT fk_occurrence_record_value_record REFERENCES app.occurrence_record (id) ON DELETE CASCADE,
        field_key    nvarchar(64)      NOT NULL,
        area_id      uniqueidentifier  NULL,
        epoch        int               NULL,
        sealed       varbinary(max)    NULL,
        public_value nvarchar(400)     NULL,
        updated_at   datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_occurrence_record_value PRIMARY KEY (record_id, field_key),
        CONSTRAINT ck_occurrence_record_value_some CHECK (sealed IS NOT NULL OR public_value IS NOT NULL)
    );
END
GO

/* Die Intentionen ziehen um — mit derselben Kennung. Kopiert, nicht gelöscht. */
IF OBJECT_ID('app.mass_intention', 'U') IS NOT NULL
    INSERT INTO app.occurrence_record
        (id, item_id, occurrence_at, list_key, mode, ordinal, status, text_public, role_id,
         origin, created_by_role_id, created_at, updated_at)
    SELECT n.id, n.item_id, n.occurrence_at, N'intencje', n.kind, n.ordinal, n.status, n.text_public, n.celebrant_role_id,
           N'legacy', n.created_by_role_id, n.created_at, n.updated_at
    FROM app.mass_intention n
    WHERE NOT EXISTS (SELECT 1 FROM app.occurrence_record r WHERE r.id = n.id);
GO

IF OBJECT_ID('app.mass_intention_field', 'U') IS NOT NULL
    INSERT INTO app.occurrence_record_value (record_id, field_key, area_id, epoch, sealed, public_value, updated_at)
    SELECT f.intention_id, f.field, f.area_id, f.epoch, f.sealed_blob, NULL, f.updated_at
    FROM app.mass_intention_field f
    WHERE EXISTS (SELECT 1 FROM app.occurrence_record r WHERE r.id = f.intention_id)
      AND NOT EXISTS (SELECT 1 FROM app.occurrence_record_value v WHERE v.record_id = f.intention_id AND v.field_key = f.field);
GO
