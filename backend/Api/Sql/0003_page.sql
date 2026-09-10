/*
    Die Seite — was ein Körper zeigt. Eine Seitenmaschine für Organisation,
    Gruppe und Ereignis; der Altbestand hatte zwei, und die Frage „wie bekomme
    ich eine Galerie auf die Seite" hatte zwei Antworten.

    Zwei Arten von Baustein, und der Unterschied entscheidet fast alles:

        statisch   der Text steht HIER
        Modul      ein Fenster auf den Arbeitsplatz; hält eine Einstellung,
                   niemals Inhalt

    Die Probe: müssten zwei Menschen dieselbe Tatsache an zwei Stellen tippen,
    ist es ein Modul. Die Messzeiten waren einmal statisch, liefen vom Kalender
    weg, und die abgetippte Fassung war die, die niemand nachführte.

    Beide sind hier `page_part` — zwei Tabellen daraus zu machen hiesse, die
    Reihenfolge auf einer Seite über zwei Tabellen zu führen.
*/

IF OBJECT_ID('app.page', 'U') IS NULL
BEGIN
    CREATE TABLE app.page
    (
        id         uniqueidentifier NOT NULL,
        body_id    uniqueidentifier NOT NULL,

        slug       nvarchar(80)  NOT NULL,
        title      nvarchar(200) NOT NULL,
        menu_label nvarchar(120) NULL,

        -- Absicht, keine Ableitung: eine noch leere interne Seite gäbe sich
        -- sonst als öffentlich aus.
        kind       nvarchar(16) NOT NULL CONSTRAINT df_page_kind DEFAULT (N'public'),

        position   int NOT NULL,
        created_at datetimeoffset NOT NULL,

        CONSTRAINT pk_page PRIMARY KEY (id),
        CONSTRAINT fk_page_body FOREIGN KEY (body_id) REFERENCES app.body (id),
        CONSTRAINT ck_page_kind CHECK (kind IN (N'public', N'internal'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_page_slug')
    CREATE UNIQUE INDEX ux_page_slug ON app.page (body_id, slug);
GO

/*
    Der Baustein.

    Die Seite kann versiegeln, nie öffnen: auf einer internen Seite ist jeder
    Baustein intern, was auch immer `is_public` behauptet. Umgekehrt gilt es
    nicht — auf einer öffentlichen Seite darf ein einzelner Baustein versiegelt
    sein.

    `kind` hat bewusst keine CHECK-Liste: die Arten wachsen, und ein CHECK, den
    man bei jeder neuen wandern muss, wird vergessen — dann lehnt die Datenbank
    ab, was die Oberfläche schon anbietet.
*/
IF OBJECT_ID('app.page_part', 'U') IS NULL
BEGIN
    CREATE TABLE app.page_part
    (
        id           uniqueidentifier NOT NULL,
        page_id      uniqueidentifier NOT NULL,

        kind         nvarchar(40) NOT NULL,
        position     int NOT NULL,

        title_public nvarchar(200)  NULL,
        title_sealed varbinary(max) NULL,
        intro_sealed varbinary(max) NULL,

        -- Bei einem Modul ist das alles, was es gibt. Steht hier ein ganzer
        -- Absatz, war es das falsche von beiden.
        config       nvarchar(max) NULL,

        is_public    bit NOT NULL CONSTRAINT df_page_part_public DEFAULT (1),
        epoch        int NULL,

        created_at   datetimeoffset NOT NULL,

        CONSTRAINT pk_page_part PRIMARY KEY (id),
        CONSTRAINT fk_page_part_page FOREIGN KEY (page_id) REFERENCES app.page (id),

        CONSTRAINT ck_page_part_epoch
            CHECK ((title_sealed IS NULL AND intro_sealed IS NULL) OR epoch IS NOT NULL)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_page_part_page')
    CREATE INDEX ix_page_part_page ON app.page_part (page_id, position);
GO

/*
    Das Formularfeld — eigene Zeilen, keine Einstellung im Baustein.

    Antworten zeigen auf Felder. Läge die Feldliste als JSON im Baustein, hätte
    eine Antwort keinen Anker: man änderte die Reihenfolge, und alle Antworten
    meinten etwas anderes.

    `identity_role` sagt, woraus Name und Kontakt gelesen werden — sonst müsste
    man raten, welche der vierzehn Spalten der Name ist.
*/
IF OBJECT_ID('app.page_field', 'U') IS NULL
BEGIN
    CREATE TABLE app.page_field
    (
        id             uniqueidentifier NOT NULL,
        part_id        uniqueidentifier NOT NULL,

        kind           nvarchar(24)  NOT NULL,
        position       int           NOT NULL,

        label_sealed   varbinary(max) NOT NULL,
        help_sealed    varbinary(max) NULL,

        -- Auch versiegelt: eine Liste möglicher Antworten sagt oft mehr als
        -- die Frage.
        options_sealed varbinary(max) NULL,
        epoch          int NOT NULL,

        is_required    bit NOT NULL CONSTRAINT df_page_field_required DEFAULT (0),
        is_half_width  bit NOT NULL CONSTRAINT df_page_field_half     DEFAULT (0),

        identity_role  nvarchar(16) NOT NULL CONSTRAINT df_page_field_identity DEFAULT (N'none'),

        CONSTRAINT pk_page_field PRIMARY KEY (id),
        CONSTRAINT fk_page_field_part FOREIGN KEY (part_id) REFERENCES app.page_part (id),
        CONSTRAINT ck_page_field_identity
            CHECK (identity_role IN (N'none', N'name', N'contact'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_page_field_part')
    CREATE INDEX ix_page_field_part ON app.page_field (part_id, position);
GO
