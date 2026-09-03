/* ===========================================================================
   rc_0013_parish_site — was eine Pfarrei auf ihrer Seite zeigt

   ---------------------------------------------------------------------------
   WARUM DAS NICHT IN rc_parish GEHOERT.

   `rc_parish` beantwortet „welche Pfarrei ist das": Name, Adresse, Ort. Diese
   Zeile beantwortet „wie sieht ihre Seite aus". Das erste ist eine Tatsache,
   das zweite eine Entscheidung, die woechentlich anders ausfallen darf.

   Getrennt gehalten, weil das Anlegen zweistufig ist: erst entsteht die
   Pfarrei mit ihrem Namen und ihrer Adresse — die Adresse wird vergeben und
   ist danach nicht mehr zu aendern —, und erst danach waehlt jemand in Ruhe
   aus, was auf der Startseite steht. Zwischen beiden Schritten darf Zeit
   liegen; deshalb ist die zweite Zeile nicht Pflicht.

   ---------------------------------------------------------------------------
   WARUM ES KLARTEXT IST.

   Alles hier gehoert auf eine oeffentliche Seite: welche Bausteine sie zeigt
   und in welcher Farbe. Es zu versiegeln waere kein Schutz, sondern nur eine
   Umstaendlichkeit — die Antwort steht anschliessend ohnehin fuer jeden
   sichtbar im Netz. Dieselbe Ueberlegung wie beim Messplan (rc_0008) und bei
   der Belegung (rc_0012): versiegelt wird, was nicht auf den Aushang gehoert.

   ---------------------------------------------------------------------------
   WARUM DIE MODULE ALS TEXT LIEGEN.

   `modules` traegt eine JSON-Liste: welcher Baustein, in welcher Reihenfolge.
   Eine eigene Tabelle je Baustein waere sauberer normalisiert und hier
   trotzdem falsch — es gibt keine Abfrage, die einzelne Bausteine sucht,
   vergleicht oder verknuepft. Sie werden immer als GANZE Seite geladen und
   als ganze Seite gespeichert.

   SQL Server prueft mit ISJSON, dass es wenigstens JSON ist. Was fuer ein
   Baustein gilt, entscheidet der Katalog im Browser; eine Liste erlaubter
   Namen hier zu fuehren hiesse, sie bei jedem neuen Baustein an zwei Stellen
   nachzuziehen.
   =========================================================================== */

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

CREATE TABLE dbo.rc_parish_site
(
    seq         bigint IDENTITY(1,1) NOT NULL,

    /* Eine Pfarrei hat hoechstens EINE Seite. Deshalb der Schluessel selbst
       und keine eigene Kennung: es gibt nichts, worauf man sonst zeigen
       wollte. */
    parish_id   uniqueidentifier     NOT NULL,

    /* Der Farbklang. Ein kurzer Name, keine Farbwerte — welche Farben dazu
       gehoeren, weiss das Stilblatt, und das aendert sich schneller als die
       Datenbank. */
    theme       nvarchar(40)         NOT NULL CONSTRAINT df_rc_parish_site_theme DEFAULT N'classic',

    /* Die Bausteine der Startseite, als JSON-Liste in Reihenfolge. */
    modules     nvarchar(max)        NOT NULL,

    updated_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_parish_site PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_parish_site_parish UNIQUE NONCLUSTERED (parish_id),
    CONSTRAINT fk_rc_parish_site_parish FOREIGN KEY (parish_id)
        REFERENCES dbo.rc_parish (id),

    /* Kein Prosatext in einer Spalte, die als JSON gelesen wird. Ohne diese
       Bedingung faellt ein falscher Inhalt erst beim Lesen auf — im Browser,
       bei jemandem, der nur die Seite ansehen wollte. */
    CONSTRAINT ck_rc_parish_site_modules_json CHECK (ISJSON(modules) = 1)
);
GO
