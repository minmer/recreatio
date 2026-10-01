/*
    ADRESY (0071) — eine Adresse aus Teilen, und ein Verzeichnis je Gebiet.

    =========================================================================
    1. DIE TEILE — `address_part`
    =========================================================================

    Postleitzahl, Post, Ort, Ortsteil, Straße: jeder Teil ist ein eigenes
    Ding mit Namen und normalisierter Form (`norm`: klein, ohne Diakritika,
    ohne „ul."). Eine Adresse SAMMELT Teile — fehlt einer (ein Dorf ohne
    Straßen, eine Adresse ohne Postleitzahl), fehlt nur er; der Rest bleibt
    vergleichbar.

        postcode   31-147
        post       Kraków            (die Poczta — nicht immer der Ort)
        locality   Zawoja            (Stadt oder Dorf)
        district   Grzegórzki        (Ortsteil, Osiedle; gehört zu einem Ort)
        street     Długa             (gehört zu einem Ort)

    Die Teile sind GEMEINSAM für alle: ein Straßenname ist keine Auskunft
    über einen Menschen, und „Długa in Kraków" zweimal anzulegen hieße, dass
    zwei Pfarreien sie nicht als dieselbe erkennen.

    =========================================================================
    2. DIE ORTE — `address_place`
    =========================================================================

    Eine Adresse eines Gebiets (z. B. einer Pfarrei, d. h. eines Bereichs):
    Verweise auf die Teile, dazu Hausnummer und Wohnung. `norm_key` ist die
    ganze Adresse normalisiert — dieselbe Adresse gibt es im Gebiet nur einmal.
    Klartext, wie ein Stadtplan: dass es das Haus Długa 5 gibt, sagt nichts
    über einen Menschen.

    =========================================================================
    3. DIE HAUSHALTE — `household`
    =========================================================================

    Wer dort wohnt — Familie, Personen, Telefon, Notizen, die Besuche der
    Kolęda Jahr für Jahr — liegt VERSIEGELT unter dem Schlüssel des Bereichs.
    Der Dienst sieht nur: an diesem Ort gibt es einen Haushalt. Gefiltert
    wird im Browser, der das Verzeichnis ganz hält (wie die Bibliothek, 0064).
*/

IF OBJECT_ID('app.address_part') IS NULL
    CREATE TABLE app.address_part
    (
        id         uniqueidentifier  NOT NULL,
        kind       nvarchar(12)      NOT NULL,
        name       nvarchar(200)     NOT NULL,
        norm       nvarchar(200)     NOT NULL,
        parent_id  uniqueidentifier  NULL,
        created_at datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_address_part PRIMARY KEY (id),
        CONSTRAINT fk_address_part_parent FOREIGN KEY (parent_id) REFERENCES app.address_part (id),
        CONSTRAINT ck_address_part_kind CHECK (kind IN (N'postcode', N'post', N'locality', N'district', N'street')),
        CONSTRAINT ck_address_part_parent CHECK ((kind IN (N'street', N'district')) OR parent_id IS NULL)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_address_part')
    CREATE UNIQUE INDEX ux_address_part ON app.address_part (kind, norm, parent_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_address_part_parent')
    CREATE INDEX ix_address_part_parent ON app.address_part (parent_id, kind, norm) WHERE parent_id IS NOT NULL;
GO

IF OBJECT_ID('app.address_place') IS NULL
    CREATE TABLE app.address_place
    (
        id          uniqueidentifier  NOT NULL,
        area_id     uniqueidentifier  NOT NULL,
        postcode_id uniqueidentifier  NULL,
        post_id     uniqueidentifier  NULL,
        locality_id uniqueidentifier  NULL,
        district_id uniqueidentifier  NULL,
        street_id   uniqueidentifier  NULL,
        house       nvarchar(16)      NULL,
        unit        nvarchar(16)      NULL,
        norm_key    nvarchar(450)     NOT NULL,
        created_at  datetimeoffset(7) NOT NULL,
        updated_at  datetimeoffset(7) NOT NULL,
        deleted_at  datetimeoffset(7) NULL,

        CONSTRAINT pk_address_place PRIMARY KEY (id),
        CONSTRAINT fk_address_place_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_address_place_postcode FOREIGN KEY (postcode_id) REFERENCES app.address_part (id),
        CONSTRAINT fk_address_place_post FOREIGN KEY (post_id) REFERENCES app.address_part (id),
        CONSTRAINT fk_address_place_locality FOREIGN KEY (locality_id) REFERENCES app.address_part (id),
        CONSTRAINT fk_address_place_district FOREIGN KEY (district_id) REFERENCES app.address_part (id),
        CONSTRAINT fk_address_place_street FOREIGN KEY (street_id) REFERENCES app.address_part (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_address_place_key')
    CREATE UNIQUE INDEX ux_address_place_key ON app.address_place (area_id, norm_key) WHERE deleted_at IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_address_place_street')
    CREATE INDEX ix_address_place_street ON app.address_place (area_id, street_id, locality_id) WHERE deleted_at IS NULL;
GO

IF OBJECT_ID('app.household') IS NULL
    CREATE TABLE app.household
    (
        id         uniqueidentifier  NOT NULL,
        area_id    uniqueidentifier  NOT NULL,
        place_id   uniqueidentifier  NULL,
        epoch      int               NOT NULL,
        doc_sealed varbinary(max)    NOT NULL,
        version    int               NOT NULL CONSTRAINT df_household_version DEFAULT (1),
        created_at datetimeoffset(7) NOT NULL,
        updated_at datetimeoffset(7) NOT NULL,
        deleted_at datetimeoffset(7) NULL,

        CONSTRAINT pk_household PRIMARY KEY (id),
        CONSTRAINT fk_household_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_household_place FOREIGN KEY (place_id) REFERENCES app.address_place (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_household_area')
    CREATE INDEX ix_household_area ON app.household (area_id, updated_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_household_place')
    CREATE INDEX ix_household_place ON app.household (place_id) WHERE place_id IS NOT NULL;
GO
