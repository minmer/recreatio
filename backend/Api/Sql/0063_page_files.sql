/*
    0063 — DATEIEN EINER SEITE, nicht nur Bilder.

    Die Bausteine aus den Ereignisseiten des Altbestands (Pliki, Mapa,
    Galeria, Osoby) brauchen mehr als Hintergrundbilder: das Regulamin als
    PDF, die Anmeldekarte zum Ausdrucken, den Track einer Strecke als GPX. Sie
    liegen in derselben Tafel wie die Bilder (`page_image`) — öffentlich wie
    die Seite, die Datei neben der Datenbank —, nur mit mehr Arten und mehr
    Platz:

      Bilder        jpeg, png, webp, gif, avif        bis 8 MB (wie bisher)
      Dokumente     pdf, docx, xlsx, pptx, odt, ods, odp
      Strecken      gpx                               bis 25 MB

    Ausgeliefert wird alles, was kein Bild ist, als Download (`PageImage.cs`):
    eine XML-Datei, die der Browser als Seite öffnete, liefe sonst unter der
    Adresse des Dienstes.

    Die Spalte `content_type` war 40 Zeichen breit — die Art eines
    Word-Dokuments hat 71.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_page_image_type' AND parent_object_id = OBJECT_ID('app.page_image'))
    ALTER TABLE app.page_image DROP CONSTRAINT ck_page_image_type;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_page_image_length' AND parent_object_id = OBJECT_ID('app.page_image'))
    ALTER TABLE app.page_image DROP CONSTRAINT ck_page_image_length;
GO

IF COL_LENGTH('app.page_image', 'content_type') < 240
    ALTER TABLE app.page_image ALTER COLUMN content_type nvarchar(120) NOT NULL;
GO

ALTER TABLE app.page_image ADD CONSTRAINT ck_page_image_type CHECK (content_type IN (
    N'image/jpeg', N'image/png', N'image/webp', N'image/gif', N'image/avif',
    N'application/pdf',
    N'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    N'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    N'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    N'application/vnd.oasis.opendocument.text',
    N'application/vnd.oasis.opendocument.spreadsheet',
    N'application/vnd.oasis.opendocument.presentation',
    N'application/gpx+xml'));
GO

ALTER TABLE app.page_image ADD CONSTRAINT ck_page_image_length CHECK (
    byte_length >= 1
    AND byte_length <= CASE WHEN content_type LIKE N'image/%' THEN 8388608 ELSE 26214400 END);
GO
