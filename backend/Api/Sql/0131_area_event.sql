/*
    0131 — EIN BEREICH ALS WYDARZENIE (2026-10-25).

    Ein Wydarzenie ist ein Bereich mit einer Marke. Die Marke zeigt auf seine
    Hauptseite und seinen Haupttermin und hält sonst nichts: Titel und Vorspann
    stehen auf der Seite (das Bild auch, slug_page.image_id), Datum, Ort und
    Programm im Termin, Menschen, Formulare und Rozmowy im Bereich.

      area_event      die Marke: Bereich, Hauptseite, Haupttermin, Art
      event_listing   ein Wydarzenie bittet, in einer fremden Liste (einem
                      Baustein „Wydarzenia") zu stehen; wer die Liste pflegt,
                      entscheidet. Für den Katalog recreatio.pl/events
                      entscheidet der Betreiber, und seine Freigabe gilt für den
                      Stand der Karte, den er gesehen hat (approved_print).

    Mit dem Bereich gehen Marke und Bitten (ON DELETE CASCADE, wie 0126); mit
    der Liste gehen ihre Bitten. Ein gelöschter Termin oder ein gelöschtes Bild
    lässt die Marke stehen und den Zeiger leer.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID('app.area_event', 'U') IS NULL
BEGIN
    CREATE TABLE app.area_event
    (
        area_id            uniqueidentifier  NOT NULL,
        slug_id            uniqueidentifier  NULL,
        item_id            uniqueidentifier  NULL,
        kind               nvarchar(40)      NULL,
        created_at         datetimeoffset(7) NOT NULL,
        created_by_role_id uniqueidentifier  NULL,
        CONSTRAINT pk_area_event PRIMARY KEY (area_id),
        CONSTRAINT fk_area_event_area FOREIGN KEY (area_id) REFERENCES app.area (id) ON DELETE CASCADE,
        CONSTRAINT fk_area_event_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_area_event_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX uq_area_event_slug ON app.area_event (slug_id) WHERE slug_id IS NOT NULL;

    CREATE TABLE app.event_listing
    (
        area_id            uniqueidentifier  NOT NULL,
        module_id          uniqueidentifier  NOT NULL,
        state              nvarchar(8)       NOT NULL,
        asked_by_role_id   uniqueidentifier  NOT NULL,
        asked_at           datetimeoffset(7) NOT NULL,
        decided_by_role_id uniqueidentifier  NULL,
        decided_at         datetimeoffset(7) NULL,
        approved_print     binary(32)        NULL,
        CONSTRAINT pk_event_listing PRIMARY KEY (area_id, module_id),
        CONSTRAINT fk_event_listing_event FOREIGN KEY (area_id) REFERENCES app.area_event (area_id) ON DELETE CASCADE,
        CONSTRAINT fk_event_listing_module FOREIGN KEY (module_id) REFERENCES app.module (id) ON DELETE CASCADE,
        CONSTRAINT ck_event_listing_state CHECK (state IN (N'asked', N'shown', N'refused'))
    );
END
GO

IF COL_LENGTH('app.slug_page', 'image_id') IS NULL
    ALTER TABLE app.slug_page ADD image_id uniqueidentifier NULL;
GO
