/*
    0133 — EIN BEREICH MIT EINER ART (2026-10-26): Wydarzenie, Grupa,
    Parafia / organizacja, Kurs.

    Ein Bereich bleibt ein Bereich. Seine Art fügt ein Profil hinzu — die
    Wizytówka (Titel und Vorspann versiegelt unter dem Schlüssel des Bereichs,
    in dem sie veröffentlicht ist), ein Bild, die Hauptseite, eine Seite für die
    Zeit danach, den Haupttermin — und schaltet Werkzeuge frei. Die Marke von
    0131 (area_event) geht darin auf.

      area_profile       das Profil eines Bereichs, eines je Bereich
      area_import_key    was ein JSON-Import („recreatio/area") unter welchem
                         Schlüssel angelegt hat — ein zweiter Import ändert es,
                         statt es zu verdoppeln
      module.label_area_id     unter welchem Bereich die FRAGEN eines Formulars
                         liegen (der Veröffentlichungsbereich); die Antworten
                         gehen weiter in den Bereich des Formulars
      slug_part.audience_area_id   ein Baustein nur für die Menschen eines
                         Bereichs (mit Konto, Link oder ihrem eigenen Platz)

    Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.area_profile', 'U') IS NULL
BEGIN
    CREATE TABLE app.area_profile
    (
        area_id            uniqueidentifier  NOT NULL,
        kind               nvarchar(20)      NOT NULL,
        /* Wohin neue Stücke standardmässig gehen (NULL: in den Bereich selbst). */
        publish_area_id    uniqueidentifier  NULL,
        /* Die Wizytówka: {title, lead} versiegelt unter card_area_id/card_epoch. */
        card_area_id       uniqueidentifier  NULL,
        card_epoch         int               NULL,
        card_sealed        varbinary(max)    NULL,
        image_id           uniqueidentifier  NULL,
        category           nvarchar(40)      NULL,
        slug_id            uniqueidentifier  NULL,
        after_slug_id      uniqueidentifier  NULL,
        item_id            uniqueidentifier  NULL,
        archive_mode       nvarchar(8)       NOT NULL CONSTRAINT df_area_profile_archive DEFAULT (N'auto'),
        archived_at        datetimeoffset(7) NULL,
        /* Welche Formulare das Archivieren geschlossen hat (JSON-Liste) — „Przywróć" öffnet genau sie. */
        archive_closed     nvarchar(max)     NULL,
        created_at         datetimeoffset(7) NOT NULL,
        created_by_role_id uniqueidentifier  NULL,
        updated_at         datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_area_profile PRIMARY KEY (area_id),
        CONSTRAINT fk_area_profile_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE,
        CONSTRAINT fk_area_profile_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_area_profile_after FOREIGN KEY (after_slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_area_profile_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id) ON DELETE SET NULL,
        CONSTRAINT ck_area_profile_kind CHECK (kind IN (N'event', N'group', N'organisation', N'course')),
        CONSTRAINT ck_area_profile_archive CHECK (archive_mode IN (N'auto', N'manual')),
        CONSTRAINT ck_area_profile_card CHECK ((card_sealed IS NULL) OR (card_area_id IS NOT NULL AND card_epoch IS NOT NULL))
    );
    CREATE UNIQUE INDEX uq_area_profile_slug ON app.area_profile (slug_id) WHERE slug_id IS NOT NULL;
    CREATE UNIQUE INDEX uq_area_profile_after ON app.area_profile (after_slug_id) WHERE after_slug_id IS NOT NULL;
    CREATE INDEX ix_area_profile_kind ON app.area_profile (kind);
END
GO

IF OBJECT_ID('app.area_import_key', 'U') IS NULL
BEGIN
    CREATE TABLE app.area_import_key
    (
        area_id    uniqueidentifier  NOT NULL,
        item_kind  nvarchar(20)      NOT NULL,
        item_key   nvarchar(120)     NOT NULL,
        ref_id     uniqueidentifier  NULL,
        ref_text   nvarchar(400)     NULL,
        updated_at datetimeoffset(7) NOT NULL,
        CONSTRAINT pk_area_import_key PRIMARY KEY (area_id, item_kind, item_key),
        CONSTRAINT fk_area_import_key_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE,
        CONSTRAINT ck_area_import_key_kind CHECK (item_kind IN (N'page', N'form', N'appointment', N'role', N'chat', N'link', N'question'))
    );
END
GO

IF COL_LENGTH('app.module', 'label_area_id') IS NULL
    ALTER TABLE app.module ADD label_area_id uniqueidentifier NULL;
GO

IF COL_LENGTH('app.slug_part', 'audience_area_id') IS NULL
    ALTER TABLE app.slug_part ADD audience_area_id uniqueidentifier NULL;
GO

/* Die Marken von 0131 werden Profile der Art „event" — das Bild zieht von der Hauptseite mit. */
IF OBJECT_ID('app.area_event', 'U') IS NOT NULL
BEGIN
    INSERT INTO app.area_profile (area_id, kind, slug_id, item_id, category, image_id, created_at, created_by_role_id, updated_at)
    SELECT e.area_id, N'event', e.slug_id, e.item_id, e.kind, p.image_id, e.created_at, e.created_by_role_id, SYSDATETIMEOFFSET()
    FROM app.area_event e
    LEFT JOIN app.slug_page p ON p.slug_id = e.slug_id
    WHERE NOT EXISTS (SELECT 1 FROM app.area_profile x WHERE x.area_id = e.area_id);
END
GO

/* Die Bitten um einen Platz in einer Liste hängen jetzt am Profil. */
IF OBJECT_ID('app.fk_event_listing_event', 'F') IS NOT NULL
    ALTER TABLE app.event_listing DROP CONSTRAINT fk_event_listing_event;
GO
IF OBJECT_ID('app.fk_event_listing_profile', 'F') IS NULL AND OBJECT_ID('app.event_listing', 'U') IS NOT NULL
    ALTER TABLE app.event_listing ADD CONSTRAINT fk_event_listing_profile
        FOREIGN KEY (area_id) REFERENCES app.area_profile (area_id) ON DELETE CASCADE;
GO

IF OBJECT_ID('app.area_event', 'U') IS NOT NULL
    DROP TABLE app.area_event;
GO
