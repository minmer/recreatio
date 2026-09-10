/*
    Die Sammlung ueber der Veranstaltung.

    -------------------------------------------------------------------------
    WAS HIER FEHLTE
    -------------------------------------------------------------------------

    Bisher war `rc_event` das oberste Ding: EINE Zeile trug die Adresse, den
    Bereich, das Amt, den Annahmeschluessel UND die Klausel nach RODO. Wer
    „recreatio" gruendete, bekam damit eine Veranstaltung, die „recreatio"
    heisst — nicht die Veranstaltungsseite des Hauses, unter der viele
    Veranstaltungen liegen.

    Das widersprach zwei Dingen, die schon feststanden:

      * das Amt sollte „den ganzen Veranstaltungsteil" verwalten, nicht ein
        einzelnes Fest;
      * nach dem Verantwortlichen fuer die Daten wird EINMAL gefragt — beim
        Veranstalter, nicht bei jedem Fest neu.

    Beides haengt jetzt an der Sammlung.

    -------------------------------------------------------------------------
    WER WAS TRAEGT
    -------------------------------------------------------------------------

        rc_event_collection  Adresse, Veranstalter, Klausel, Amt, eigener
                             Bereich (der Ort der Sammlung selbst: Katalog,
                             spaeter ihr eigener Kopf und Fuss).
              |
              +-- rc_event   EIGENER Bereich, EIGENE Schluessel, EIGENES Amt.

    <b>Warum jede Veranstaltung ihren eigenen Bereich behaelt.</b> Sonst
    oeffnete, wer beim Pfarrfest die Anmeldungen fuehrt, auch die Anmeldungen
    der Pilgerfahrt. Es ist dieselbe Grenze, aus der die Veranstaltung schon
    heute nicht im Bereich der Pfarrei liegt — nur eine Ebene tiefer. Das Amt
    der Sammlung HAELT die Aemter der einzelnen Veranstaltungen, wer also die
    Sammlung verwaltet, kommt ueberall hin; wer nur ein Fest bekommt, bleibt
    dort.

    -------------------------------------------------------------------------
    DIE ADRESSE
    -------------------------------------------------------------------------

    `/event/recreatio/kal26` — die Sammlung nennt sich global eindeutig, die
    Veranstaltung nur INNERHALB ihrer Sammlung. Damit darf jede Pfarrei ein
    „festyn-2026" haben, ohne dass die erste den Namen fuer alle verbraucht.

    Deshalb wandert die Eindeutigkeit von `rc_event (slug)` nach
    `rc_event (collection_id, slug)`.
*/

IF OBJECT_ID('dbo.rc_event_collection', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_collection
    (
        id            uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_collection PRIMARY KEY,

        tenant_id     uniqueidentifier NOT NULL,

        /* Der Ort der Sammlung selbst — nicht der einer ihrer Veranstaltungen. */
        area_id       uniqueidentifier NOT NULL,

        /*
            Das Amt, das den ganzen Veranstaltungsteil verwaltet. Es haelt die
            Aemter der einzelnen Veranstaltungen; weitergeben laesst es sich,
            ohne jemandem ein Konto zu ueberlassen.
        */
        office_role_id uniqueidentifier NULL,

        slug          nvarchar(80)  NOT NULL,
        title         nvarchar(200) NOT NULL,

        /*
            Der Verantwortliche fuer die Daten — EINMAL fuer alles, was unter
            dieser Sammlung Anmeldungen entgegennimmt. Jawtext, weil die
            Klausel gelesen werden muss, bevor jemand ein Konto hat; dieselbe
            Grenze wie bei `title_public` gegen `title_sealed` an der Messe.
        */
        organizer_role_id uniqueidentifier NULL,
        organizer_name    nvarchar(200) NULL,
        organizer_address nvarchar(400) NULL,
        organizer_email   nvarchar(200) NULL,

        lifecycle     nvarchar(20) NOT NULL
            CONSTRAINT df_rc_event_collection_lifecycle DEFAULT N'draft',

        created_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT ck_rc_event_collection_lifecycle
            CHECK (lifecycle IN (N'draft', N'published', N'archived')),

        CONSTRAINT fk_rc_event_collection_area
            FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),

        CONSTRAINT fk_rc_event_collection_office
            FOREIGN KEY (office_role_id) REFERENCES dbo.rc_role (id),

        CONSTRAINT fk_rc_event_collection_organizer
            FOREIGN KEY (organizer_role_id) REFERENCES dbo.rc_role (id)
    );
END
GO

/* Die Adresse der Sammlung ist global eindeutig — sie steht allein im Link. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rc_event_collection_slug')
BEGIN
    CREATE UNIQUE INDEX ux_rc_event_collection_slug
        ON dbo.rc_event_collection (slug);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_event_collection_organizer')
BEGIN
    CREATE INDEX ix_rc_event_collection_organizer
        ON dbo.rc_event_collection (organizer_role_id)
        WHERE organizer_role_id IS NOT NULL;
END
GO

/* -------------------------------------------------------------------------
   Die Veranstaltung bekommt ihre Sammlung
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_event', 'collection_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD collection_id uniqueidentifier NULL;
END
GO

/*
    NACHTRAG FUER SCHON VORHANDENE VERANSTALTUNGEN.

    Jede Veranstaltung ohne Sammlung bekommt eine eigene, die ihre Adresse,
    ihren Veranstalter und ihre Klausel uebernimmt. Der Bereich der Sammlung
    ist zunaechst der der Veranstaltung — sie hatte bisher keinen anderen, und
    einen leeren zu erfinden hiesse, hier Schluessel zu erzeugen, was ein
    Migrationsskript nicht kann und nicht koennen soll.

    Die Veranstaltung BEHAELT dabei ihre Adresse. Sie liegt danach unter
    `/event/<name>/<name>`; das ist haesslich, aber niemand verliert etwas, und
    umbenennen laesst es sich mit einer Hand. Der stille Weg — die Adresse hier
    zu erfinden — waere schlechter: er aendert einen Link, von dem das Skript
    nicht weiss, wer ihn schon hat.
*/
IF COL_LENGTH('dbo.rc_event', 'collection_id') IS NOT NULL
BEGIN
    /*
        Das nachgetragene Amt bleibt LEER.

        Ein Amt anzulegen hiesse, einen Rollenschluessel zu erzeugen und ihn
        unter dem Schluessel eines Halters zu verschliessen — ein Skript hat
        keinen davon, und es soll auch keinen bekommen. Wer eine so
        nachgetragene Sammlung weiterfuehren will, gruendet sie neu; die
        vorhandene Veranstaltung bleibt lesbar, wo sie ist.
    */
    INSERT INTO dbo.rc_event_collection
        (id, tenant_id, area_id, office_role_id, slug, title,
         organizer_role_id, organizer_name, organizer_address, organizer_email,
         lifecycle, created_at)
    SELECT NEWID(), e.tenant_id, e.area_id, NULL, e.slug, e.title,
           e.organizer_role_id, e.organizer_name, e.organizer_address, e.organizer_email,
           e.lifecycle, e.created_at
    FROM dbo.rc_event e
    WHERE e.collection_id IS NULL;

    /*
        Zusammengefuehrt wird ueber die Adresse. Sie war bis zu diesem Skript
        global eindeutig — es kann also keine zweite Veranstaltung gleichen
        Namens geben, der die falsche Sammlung zufiele.
    */
    UPDATE e
       SET e.collection_id = c.id
      FROM dbo.rc_event e
      JOIN dbo.rc_event_collection c ON c.slug = e.slug
     WHERE e.collection_id IS NULL;
END
GO

/* -------------------------------------------------------------------------
   Die Eindeutigkeit zieht um
   ------------------------------------------------------------------------- */

/*
    Der alte Index heisst je nach Erzeugung anders, und das Skript, das
    `rc_event` angelegt hat, ist nicht mehr da (es ging mit 22 anderen in
    4bd7e4ab verloren). Also wird er gesucht, nicht geraten: jeder eindeutige
    Index ueber GENAU der Spalte `slug`.

    Ein Skript, das hier einen Namen raet, laeuft auf dem Entwicklungsrechner
    durch und faellt auf dem Server um — oder schlimmer: es findet nichts,
    meldet Erfolg, und die alte Schranke steht weiter im Weg.
*/
DECLARE @index sysname;

SELECT TOP 1 @index = i.name
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.rc_event')
  AND i.is_unique = 1
  AND i.type_desc <> 'HEAP'
  AND (SELECT COUNT(*) FROM sys.index_columns ic
        WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id) = 1
  AND EXISTS (SELECT 1 FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
                AND c.name = 'slug');

IF @index IS NOT NULL
BEGIN
    /*
        Eine eindeutige Bedingung (UNIQUE CONSTRAINT) traegt zwar auch einen
        Index, laesst sich aber nur als Bedingung fallen lassen. Beides kommt
        vor, je nachdem wie die Tabelle entstanden ist.

        Der Befehl wird ERST in eine Variable gebaut: `EXEC(...)` nimmt keinen
        zusammengesetzten Ausdruck, sondern nur eine fertige Zeichenfolge.
    */
    DECLARE @drop nvarchar(400);

    IF EXISTS (SELECT 1 FROM sys.key_constraints
                WHERE parent_object_id = OBJECT_ID('dbo.rc_event') AND name = @index)
        SET @drop = N'ALTER TABLE dbo.rc_event DROP CONSTRAINT ' + QUOTENAME(@index);
    ELSE
        SET @drop = N'DROP INDEX ' + QUOTENAME(@index) + N' ON dbo.rc_event';

    EXEC sp_executesql @drop;
END
GO

/*
    Jetzt, da jede Zeile eine Sammlung hat, wird die Spalte zur Pflicht.

    <b>Warum nicht einfach nullbar lassen.</b> Eine Veranstaltung ohne Sammlung
    haette keine Adresse, unter der man sie findet, und faellt zugleich aus der
    Eindeutigkeitspruefung heraus — zwei davon koennten denselben Namen tragen.
    Faellt dieser Schritt um, ist der Nachtrag oben unvollstaendig geblieben;
    das laut zu erfahren ist besser, als es still zu verschleppen.
*/
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.rc_event')
              AND name = 'collection_id' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.rc_event ALTER COLUMN collection_id uniqueidentifier NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rc_event_collection_slug_pair')
BEGIN
    CREATE UNIQUE INDEX ux_rc_event_collection_slug_pair
        ON dbo.rc_event (collection_id, slug)
        WHERE collection_id IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_event_collection')
BEGIN
    ALTER TABLE dbo.rc_event
        ADD CONSTRAINT fk_rc_event_collection
        FOREIGN KEY (collection_id) REFERENCES dbo.rc_event_collection (id);
END
GO
