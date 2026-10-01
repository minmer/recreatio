/*
    NOTATKI UND SLAJDY (0061).

    1. DIE ROZMOWA MIT SICH SELBST — `chat.kind = 'self'`. Sie liegt im
       eigenen Bereich der Person (`area.personal_role_id`, 0054), in dem
       ohnehin niemand sonst ist; `uq_chat_area` sorgt dafür, dass es sie je
       Person nur einmal gibt. Zu zweit (`pair_key`) ist sie nicht.

    2. EINE SEITE ALS FOLGE VON SLAJDY — `slug.page_mode` ('page' | 'slides';
       NULL heisst 'page') und `slug.page_theme` (JSON: hell/dunkel, vier
       Farben, der Titelslajd). Wie `page_logic` an der Adresse, nicht am
       Inhalt: ein Alias zeigt die Seite seines Ziels, mit dessen Art.
       Die Hintergründe JEDES Slajds liegen im `layout` seines Bausteins —
       dort, wo der Baustein auch sonst beschreibt, wie er steht.

    3. BILDER EINER SEITE — `page_image`. Öffentlich wie die Seite selbst
       (der Hintergrund eines Slajds wird ohne Konto ausgeliefert); die Datei
       liegt neben der Datenbank, die Zeile sagt, wem sie gehört und was sie ist.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_chat_kind' AND parent_object_id = OBJECT_ID('app.chat'))
    ALTER TABLE app.chat DROP CONSTRAINT ck_chat_kind;
GO

ALTER TABLE app.chat ADD CONSTRAINT ck_chat_kind CHECK (kind IN (N'area', N'group', N'direct', N'self'));
GO

IF COL_LENGTH('app.slug', 'page_mode') IS NULL
    ALTER TABLE app.slug ADD page_mode nvarchar(8) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_mode')
    ALTER TABLE app.slug ADD CONSTRAINT ck_slug_page_mode CHECK (page_mode IS NULL OR page_mode IN (N'page', N'slides'));
GO

IF COL_LENGTH('app.slug', 'page_theme') IS NULL
    ALTER TABLE app.slug ADD page_theme nvarchar(8000) NULL;
GO

IF OBJECT_ID('app.page_image', 'U') IS NULL
    CREATE TABLE app.page_image
    (
        id                 uniqueidentifier  NOT NULL,
        slug_id            uniqueidentifier  NOT NULL,
        content_type       nvarchar(40)      NOT NULL,
        byte_length        int               NOT NULL,
        name               nvarchar(200)     NULL,
        created_at         datetimeoffset(7) NOT NULL,
        created_by_role_id uniqueidentifier  NULL,

        CONSTRAINT pk_page_image PRIMARY KEY (id),
        CONSTRAINT fk_page_image_slug FOREIGN KEY (slug_id) REFERENCES app.slug (id),
        CONSTRAINT fk_page_image_role FOREIGN KEY (created_by_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_page_image_type CHECK (content_type IN (N'image/jpeg', N'image/png', N'image/webp', N'image/gif', N'image/avif')),
        CONSTRAINT ck_page_image_length CHECK (byte_length BETWEEN 1 AND 8388608)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_page_image_slug')
    CREATE INDEX ix_page_image_slug ON app.page_image (slug_id, created_at);
GO
