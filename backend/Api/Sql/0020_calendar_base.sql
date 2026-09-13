/*
    Der Kalender wird die Grundlage — und die Sichtbarkeit wird ein SCHLUESSEL.

    =========================================================================
    1. WARUM `visibility` FORTFAELLT
    =========================================================================

    0004 fuehrte `visibility IN (private, area, public)`. Das ist ein Schalter,
    den der Dienst beachten MUSS: er liest die Spalte und entscheidet, wem er
    die Zeile gibt. Wer die Bedingung einmal falsch schreibt, gibt sie dem
    Falschen — und nichts an der Zeile haette ihn gehindert.

    An seine Stelle tritt `visibility_area_id`: der Bereich, dessen Schluessel
    man braucht, damit der Eintrag fuer einen ueberhaupt EXISTIERT.

        Schluessel in der Hand   -> man sieht ihn
        Epoche offengelegt       -> jeder sieht ihn
        weder noch               -> die Zeile faellt aus der Antwort

    „Oeffentlich" ist damit kein eigener Zustand mehr, sondern derselbe
    Mechanismus: ein Bereich, dessen Epochenschluessel offenliegt (0019). Es
    gibt nur noch EINEN Weg, und er ist nachpruefbar — an einer Zuteilung oder
    an `key_public`, nicht an der Sorgfalt einer WHERE-Bedingung.

    Und: ein privater Eintrag faellt GANZ heraus, nicht nur sein Inhalt. Zu
    zeigen, DASS dort etwas steht, waere schon eine Auskunft ueber den Tag —
    0004 sagt das selbst, konnte es aber mit einem Schalter nicht halten.

    =========================================================================
    2. WARUM DIE FELDER EINZELN IHREN BEREICH NENNEN
    =========================================================================

    Bisher: eine Spalte `epoch` und drei Huellen daneben — alles unter EINEM
    Schluessel. Damit laesst sich nicht sagen, was gesagt werden soll:

        die ZEIT unter einem Bereich, dessen Schluessel offenliegt
        die NOTIZ unter dem der Kanzlei, dessen Schluessel nicht offenliegt

    Also eine Zeile je verschluesseltem Feld, und jede nennt ihren eigenen
    Bereich und ihre eigene Epoche. Dieselbe Messe kann dann im Schaukasten
    stehen und trotzdem etwas tragen, das nur drinnen zu lesen ist.

    <b>Der Dienst oeffnet nichts.</b> Er legt Huellen ab und gibt sie heraus,
    mitsamt Bereich und Epoche. Wer sie aufbekommt, entscheidet sich an den
    Schluesseln des Lesers.

    =========================================================================
    3. WARUM DIE MESSE HIER EINZIEHT
    =========================================================================

    0018 legte `app.mass_item` an, und die Begruendung stand dabei: es gab
    keinen Kalender, an den sie haette haengen koennen. Den gibt es — seit 0004,
    mit Wiederholung, Ausnahmen und `kind IN (..., mass, confession, ...)`.

    Damit faellt die Begruendung fort und mit ihr die Tabelle. Der Gewinn ist
    nicht Ordnung, sondern der Tagesblick: Messe und Scholaprobe liegen in
    derselben Tabelle, und eine Ansicht fragt EINE Quelle statt zwei.

    `app.mass_intention` bleibt, bis auf ihren Fremdschluessel. Ihre Adresse
    bleibt `(item_id, occurrence_at)` — nur ist `item_id` ab hier ein
    Kalendereintrag, und `occurrence_at` derselbe Schluessel, unter dem
    `app.calendar_exception` ihre Verschiebungen fuehrt.

    =========================================================================
    4. WARUM HIER KEINE ZEILEN WANDERN
    =========================================================================

    Es gibt keine. Die Datenbank wurde eben neu aufgesetzt. Waere das anders,
    stuende hier ein Umzug, und der waere die eigentliche Arbeit. Dass gerade
    jetzt nichts darin steht, ist der Grund, es JETZT zu tun.
*/

/* -------------------------------------------------------------------------
   1. Der Eintrag verliert seinen Schalter und seine Huellen
   ------------------------------------------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_visibility')
    ALTER TABLE app.calendar_item DROP CONSTRAINT ck_item_visibility;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_item_epoch')
    ALTER TABLE app.calendar_item DROP CONSTRAINT ck_item_epoch;
GO

/* Eine Spalte mit Vorgabe laesst sich nicht werfen, solange die Vorgabe steht. */
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'df_item_visibility')
    ALTER TABLE app.calendar_item DROP CONSTRAINT df_item_visibility;
GO

IF COL_LENGTH('app.calendar_item', 'visibility') IS NOT NULL
    ALTER TABLE app.calendar_item DROP COLUMN visibility;
GO

IF COL_LENGTH('app.calendar_item', 'title_sealed') IS NOT NULL
    ALTER TABLE app.calendar_item DROP COLUMN title_sealed;
GO

IF COL_LENGTH('app.calendar_item', 'location_sealed') IS NOT NULL
    ALTER TABLE app.calendar_item DROP COLUMN location_sealed;
GO

IF COL_LENGTH('app.calendar_item', 'notes_sealed') IS NOT NULL
    ALTER TABLE app.calendar_item DROP COLUMN notes_sealed;
GO

IF COL_LENGTH('app.calendar_item', 'epoch') IS NOT NULL
    ALTER TABLE app.calendar_item DROP COLUMN epoch;
GO

/* -------------------------------------------------------------------------
   2. … und bekommt den Bereich, der ueber sein Dasein entscheidet

   In zwei Schritten: erst als NULL, dann verpflichtend. Die Tabelle ist leer,
   also fuellt der Zwischenschritt nichts — bei einer vollen waere genau hier
   der Umzug.
   ------------------------------------------------------------------------- */

IF COL_LENGTH('app.calendar_item', 'visibility_area_id') IS NULL
    ALTER TABLE app.calendar_item ADD visibility_area_id uniqueidentifier NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.calendar_item')
             AND name = 'visibility_area_id' AND is_nullable = 1)
    ALTER TABLE app.calendar_item ALTER COLUMN visibility_area_id uniqueidentifier NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_item_visibility_area')
    ALTER TABLE app.calendar_item ADD CONSTRAINT fk_item_visibility_area
        FOREIGN KEY (visibility_area_id) REFERENCES app.area (id);
GO

/*
    Die Frage jeder Anzeige lautet: „welche Eintraege dieses Kalenders darf ich
    sehen, in diesem Zeitraum". Genau danach ist sortiert.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_visible')
    CREATE INDEX ix_item_visible
        ON app.calendar_item (calendar_id, visibility_area_id, starts_at)
        INCLUDE (ends_at);
GO

/*
    Und die Frage des Aushangs ueber ALLE Kalender hinweg: „welche Messen gibt
    es". Ohne diesen Index ist das ein Durchgang durch jeden Eintrag jedes
    Kalenders — und genau das soll die Sammelansicht koennen.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_item_kind_when')
    CREATE INDEX ix_item_kind_when
        ON app.calendar_item (kind, starts_at)
        INCLUDE (calendar_id, visibility_area_id, ends_at);
GO

/* -------------------------------------------------------------------------
   3. Ein verschluesseltes Feld, mit seinem eigenen Bereich
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.calendar_field', 'U') IS NULL
BEGIN
    CREATE TABLE app.calendar_field
    (
        item_id     uniqueidentifier NOT NULL,

        /*
            Der Name MUSS einer aus `Kernel.Field` sein — er geht in die AAD
            ein (3.13), und ein Tippfehler ergaebe eine Huelle, die sich nie
            wieder oeffnen laesst.

            Die Prueflliste ist deshalb Absicht und keine Umstaendlichkeit: ein
            neues verschluesseltes Feld verlangt eine Wanderung, und genau das
            erzwingt die Frage, welcher Klasse es angehoert.
        */
        field       nvarchar(32)     NOT NULL,

        /* WELCHER Bereich es versiegelt hat — je Feld ein eigener. */
        area_id     uniqueidentifier NOT NULL,
        epoch       int              NOT NULL,

        sealed_blob varbinary(max)   NOT NULL,

        updated_at  datetimeoffset   NOT NULL,

        CONSTRAINT pk_calendar_field PRIMARY KEY (item_id, field),

        CONSTRAINT fk_calendar_field_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id),
        CONSTRAINT fk_calendar_field_area FOREIGN KEY (area_id) REFERENCES app.area (id),

        CONSTRAINT ck_calendar_field_name
            CHECK (field IN (N'title', N'location', N'notes')),

        CONSTRAINT ck_calendar_field_epoch CHECK (epoch >= 1)
    );
END
GO

/*
    „Was liegt unter diesem Bereich" — die Frage beim Schnitt einer Epoche und
    beim Offenlegen. Ohne den Index ein Durchgang durch alle Felder.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_calendar_field_area')
    CREATE INDEX ix_calendar_field_area ON app.calendar_field (area_id, epoch);
GO

/* -------------------------------------------------------------------------
   4. Die Intention haengt am Kalendereintrag
   ------------------------------------------------------------------------- */

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_mass_intention_item')
    ALTER TABLE app.mass_intention DROP CONSTRAINT fk_mass_intention_item;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_mass_intention_item')
    ALTER TABLE app.mass_intention ADD CONSTRAINT fk_mass_intention_item
        FOREIGN KEY (item_id) REFERENCES app.calendar_item (id);
GO

/* -------------------------------------------------------------------------
   5. Geber und Gabe — jetzt erst moeglich

   0018 liess sie ABSICHTLICH weg, und die Begruendung stand dabei: „der
   Altbestand versiegelt sie unter dem Epochenschluessel eines Bereichs, den es
   hier nicht gibt, und Spalten anzulegen, die nichts fuellt, waere ein
   Versprechen, das die Zeile nicht haelt."

   Den Bereich gibt es jetzt. Damit faellt die Begruendung fort.

   Warum eine eigene Tabelle und nicht zwei Spalten: es ist dieselbe Frage wie
   beim Kalendereintrag. Der Text wird VORGELESEN und haengt im Schaukasten —
   er bleibt im Klartext. Geber und Gabe stehen auf keinem Zettel an der Tuer,
   und sie gehoeren nicht zwangslaeufig demselben Bereich wie der Aushang: die
   Gabe ist eine Sache der Kanzlei, der Aushang eine der Pfarrei.
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.mass_intention_field', 'U') IS NULL
BEGIN
    CREATE TABLE app.mass_intention_field
    (
        intention_id uniqueidentifier NOT NULL,

        /* Aus `Kernel.Field` — MassIntentionGiver, MassIntentionOffering. */
        field        nvarchar(32)     NOT NULL,

        area_id      uniqueidentifier NOT NULL,
        epoch        int              NOT NULL,

        sealed_blob  varbinary(max)   NOT NULL,

        updated_at   datetimeoffset   NOT NULL,

        CONSTRAINT pk_mass_intention_field PRIMARY KEY (intention_id, field),

        CONSTRAINT fk_mass_intention_field_intention
            FOREIGN KEY (intention_id) REFERENCES app.mass_intention (id),
        CONSTRAINT fk_mass_intention_field_area
            FOREIGN KEY (area_id) REFERENCES app.area (id),

        CONSTRAINT ck_mass_intention_field_name
            CHECK (field IN (N'giver', N'offering')),

        CONSTRAINT ck_mass_intention_field_epoch CHECK (epoch >= 1)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_mass_intention_field_area')
    CREATE INDEX ix_mass_intention_field_area ON app.mass_intention_field (area_id, epoch);
GO

/* -------------------------------------------------------------------------
   6. Die eigene Messtabelle faellt

   Erst jetzt: solange der Fremdschluessel dorthin zeigte, liesse sie sich
   nicht werfen.
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.mass_item', 'U') IS NOT NULL
    DROP TABLE app.mass_item;
GO
