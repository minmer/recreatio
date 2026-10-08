/*
    PREZENTACJA (0085) — die dritte Art einer Seite.

    `slug.page_mode` kannte zwei Werte: 'page' (Bausteine im Raster) und
    'slides' (jeder Baustein ein Bildschirm, 0062). Jetzt kommt
    'presentation': SZENEN, auf denen die Bausteine frei stehen — mehrere auf
    einem Bildschirm, mit Schritten, Übergängen, einer Kamera durch den Raum
    und Bausteinen, die von einer Szene zur nächsten wandern. Der Grundstein
    ist die Startseite des Altbestands (`legacy/public/pages/FrontPage.tsx`);
    darauf baut der Editor für Präsentationen auf.

    Zwölf Zeichen: die Spalte war acht breit. Die Prüfung muss dafür erst
    weichen und kommt danach mit dem dritten Wert zurück.

    Die Szenen selbst stehen im Aussehen der Seite (`page_theme`, JSON unter
    "show"), der Platz eines Bausteins auf ihnen in seinem `layout` ("show") —
    dort, wo er auch sonst beschreibt, wie er steht. Kein neuer Ort, keine
    neue Tabelle.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_mode')
    ALTER TABLE app.slug DROP CONSTRAINT ck_slug_page_mode;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug') AND name = 'page_mode' AND max_length < 32)
    ALTER TABLE app.slug ALTER COLUMN page_mode nvarchar(16) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_mode')
    ALTER TABLE app.slug ADD CONSTRAINT ck_slug_page_mode
        CHECK (page_mode IS NULL OR page_mode IN (N'page', N'slides', N'presentation'));
GO
