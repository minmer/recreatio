/*
    DIE BIBLIOTHEK (0064) — Quellen, Zitate, Personen, Themen und die eigenen
    Texte, als EIN Bestand, auf dem andere Teile aufbauen.

    Wunsch (2026-10-01): Predigten veröffentlichen, mit weiterführendem Text
    und den Quellen, die darin stecken; das Schreiben von Büchern und Texten
    ordnen; eine Sammlung von Zitaten mit ihren Beschreibungen. Und: das soll
    die Grundlage des neuen Cogita sein — ein Werk, ein Autor, ein Zitat gibt
    es einmal, und alles, was sie braucht (eine Predigt, ein Buch, später
    Karteikarten und Wiederholungen), zeigt auf sie.

    =========================================================================
    WAS DER DIENST WEISS — UND WAS NICHT
    =========================================================================

    Ein Eintrag liegt VERSIEGELT unter dem Schlüssel des Bereichs, dem die
    Bibliothek gehört (`sealed`, ein JSON-Dokument je Eintrag). Der Dienst
    kennt davon nur die Art (`kind`), die Epoche und die Zeiten. Verweise —
    welches Zitat aus welchem Werk, welche Predigt welche Quelle nennt —
    stehen IN der Hülle; der Dienst sieht sie nicht.

    VERÖFFENTLICHT wird ausdrücklich: der Browser schreibt eine offene
    Fassung daneben (`public_json`, kurz `public_summary`), und zwar nur die
    Felder, die die Art als öffentlich nennt — die privaten Notizen nie. Mit
    einem Text gehen die Quellen hinaus, die er nennt (`published_as =
    implicit`); was man selbst hinausstellt, etwa ein Zitat für die Sammlung,
    ist `explicit`. Die Verweise der offenen Fassungen stehen in
    `library_public_ref`, damit eine öffentliche Seite einen Text samt seinen
    Quellen in EINER Anfrage bekommt.

    =========================================================================
    ABGLEICH
    =========================================================================

    Der Browser hält die ganze Bibliothek offen im Speicher (Suchen, Verweise
    und Rückverweise rechnet er selbst — der Dienst kann es nicht). Er holt
    nur, was sich seit dem letzten Mal geändert hat (`updated_at`); ein
    gelöschter Eintrag bleibt als Grabstein stehen (`deleted_at`, ohne Hülle),
    damit ein anderer Browser von der Löschung erfährt.

    `version` zählt jede Änderung: wer mit einem alten Stand speichert, wird
    abgewiesen, statt die Änderung eines anderen zu überschreiben.
*/

IF OBJECT_ID('app.library', 'U') IS NULL
    CREATE TABLE app.library
    (
        id           uniqueidentifier  NOT NULL,

        /* Wem sie gehört — und unter wessen Schlüssel ihr Inhalt liegt. */
        area_id      uniqueidentifier  NOT NULL,

        epoch        int               NOT NULL,
        name_sealed  varbinary(4096)   NOT NULL,
        created_at   datetimeoffset(7) NOT NULL,
        updated_at   datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_library PRIMARY KEY (id),
        CONSTRAINT fk_library_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_library_epoch CHECK (epoch >= 1)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_area')
    CREATE INDEX ix_library_area ON app.library (area_id);
GO

IF OBJECT_ID('app.library_entry', 'U') IS NULL
    CREATE TABLE app.library_entry
    (
        id              uniqueidentifier  NOT NULL,
        library_id      uniqueidentifier  NOT NULL,

        /* person, work, quote, topic, text, project — und was später kommt (Cogita). */
        kind            nvarchar(32)      NOT NULL,

        epoch           int               NOT NULL,

        /* NULL: gelöscht (Grabstein für den Abgleich). */
        sealed          varbinary(max)    NULL,

        version         int               NOT NULL,
        created_at      datetimeoffset(7) NOT NULL,
        updated_at      datetimeoffset(7) NOT NULL,
        deleted_at      datetimeoffset(7) NULL,

        /* Die offene Fassung — nur, was die Art als öffentlich nennt. */
        published_at    datetimeoffset(7) NULL,
        published_as    nvarchar(10)      NULL,
        public_key      nvarchar(120)     NULL,
        public_sort     nvarchar(64)      NULL,
        public_summary  nvarchar(max)     NULL,
        public_json     nvarchar(max)     NULL,

        CONSTRAINT pk_library_entry PRIMARY KEY (id),
        CONSTRAINT fk_library_entry_library FOREIGN KEY (library_id) REFERENCES app.library (id),
        CONSTRAINT ck_library_entry_kind CHECK (LEN(kind) BETWEEN 2 AND 32 AND kind NOT LIKE N'%[^a-z0-9_-]%'),
        CONSTRAINT ck_library_entry_epoch CHECK (epoch >= 1),
        CONSTRAINT ck_library_entry_version CHECK (version >= 1),
        CONSTRAINT ck_library_entry_sealed CHECK ((deleted_at IS NULL AND sealed IS NOT NULL) OR (deleted_at IS NOT NULL AND sealed IS NULL)),
        CONSTRAINT ck_library_entry_public CHECK (
            (published_at IS NULL AND published_as IS NULL AND public_json IS NULL AND public_summary IS NULL)
            OR (published_at IS NOT NULL AND published_as IN (N'explicit', N'implicit') AND public_json IS NOT NULL AND deleted_at IS NULL))
    );
GO

/* Der Abgleich: was sich in dieser Bibliothek seit … geändert hat. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_entry_sync')
    CREATE INDEX ix_library_entry_sync ON app.library_entry (library_id, updated_at);
GO

/* Die öffentlichen Listen: Predigten einer Bibliothek, Zitate einer Sammlung. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_entry_public')
    CREATE INDEX ix_library_entry_public ON app.library_entry (library_id, kind, public_sort)
        WHERE published_at IS NOT NULL;
GO

IF OBJECT_ID('app.library_public_ref', 'U') IS NULL
    CREATE TABLE app.library_public_ref
    (
        entry_id  uniqueidentifier NOT NULL,
        ref_id    uniqueidentifier NOT NULL,

        CONSTRAINT pk_library_public_ref PRIMARY KEY (entry_id, ref_id),
        CONSTRAINT fk_library_public_ref_entry FOREIGN KEY (entry_id) REFERENCES app.library_entry (id),
        CONSTRAINT fk_library_public_ref_ref FOREIGN KEY (ref_id) REFERENCES app.library_entry (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_public_ref_ref')
    CREATE INDEX ix_library_public_ref_ref ON app.library_public_ref (ref_id);
GO
