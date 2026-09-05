/*
    Messen, Intentionen, und die Bruecke zwischen Kalender und Belegung.

    WAS HIER ZUSAMMENKOMMT.

    Drei Dinge sahen bisher verschieden aus und sind derselbe Satz: ETWAS
    BELEGT EINE ZEITSPANNE. Eine Messe belegt die Kirche um 18 Uhr; eine
    Gruppe den Pfarrsaal am Dienstag; ein Kurs ein Zimmer eine Woche lang.

    Der Kalender kann bereits Zeit, Wiederholung und Ausnahmen. Das
    Belegungsmodul kann bereits „ist diese Sache frei". Nur wussten sie
    nichts voneinander. Diese Migration verbindet sie und legt die
    Intentionen an — das einzige wirklich Neue.

    WARUM DIE INTENTION AM VORKOMMEN HAENGT UND NICHT AN DER REIHE.

    „Werktags 18 Uhr" ist EIN Kalendereintrag mit vielen Vorkommen. Die
    Intention gilt aber fuer den Dienstag, nicht fuer die Reihe: am Mittwoch
    ist es eine andere. Deshalb (item_id, occurrence_at) — dieselbe Adresse,
    unter der der Kalender schon seine Ausnahmen fuehrt
    (rc_calendar_exception). Zwei Adressierungen fuer dasselbe Vorkommen
    waeren zwei Gelegenheiten, aneinander vorbeizugreifen.

    WARUM DER TEXT IM KLARTEXT STEHT UND DER GEBER NICHT.

    Eine Intention wird in der Kirche VORGELESEN und im Pfarrblatt gedruckt.
    Sie geheim zu halten hiesse, das Modul gegen seinen Zweck zu bauen.

    Wer sie gegeben und was er gegeben hat, ist etwas anderes: das steht auf
    keinem Zettel an der Tuer. Deshalb liegen beide in DERSELBEN Zeile, aber
    nicht in derselben Form — der Text offen, Geber und Gabe versiegelt.

    Das ist genau die Trennung, die der Kalender mit title_public und
    title_sealed schon macht, und aus demselben Grund: wer beides in ein Feld
    legt, muss bei jeder Anzeige neu entscheiden, wie viel er verraet — und
    irgendeine entscheidet falsch.
*/

/* -------------------------------------------------------------------------
   1. Ein Kalendereintrag kann eine Sache belegen.
   ------------------------------------------------------------------------- */

/*
    EINE Sache, nicht mehrere. Eine Messe ist in einer Kirche, eine Sitzung in
    einem Raum. Der Fall „zwei Raeume gleichzeitig" ist selten genug, dass eine
    eigene Tabelle dafuer heute Aufwand ohne Gegenwert waere; sie liesse sich
    spaeter nachtragen, ohne diese Spalte zu stoeren.

    NULL heisst: belegt nichts. Eine Pfarrei, die noch keine Raeume angelegt
    hat, bekommt trotzdem einen Messplan — nur blockiert er nichts.
*/
IF COL_LENGTH('dbo.rc_calendar_item', 'resource_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_calendar_item ADD resource_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_calendar_item_resource')
BEGIN
    ALTER TABLE dbo.rc_calendar_item
        ADD CONSTRAINT fk_rc_calendar_item_resource
        FOREIGN KEY (resource_id) REFERENCES dbo.rc_resource (id);
END
GO

/*
    Die Frage der Belegungsseite lautet „was liegt auf DIESER Sache" — nicht
    „was gehoert zu diesem Kalender". Ohne diesen Index waere jede solche
    Frage ein Durchgang durch alle Eintraege.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_calendar_item_resource')
BEGIN
    CREATE INDEX ix_rc_calendar_item_resource
        ON dbo.rc_calendar_item (resource_id, starts_at)
        WHERE resource_id IS NOT NULL;
END
GO

/* -------------------------------------------------------------------------
   2. Die Intentionen.
   ------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.rc_mass_intention', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_mass_intention (
        id                uniqueidentifier NOT NULL
                          CONSTRAINT pk_rc_mass_intention PRIMARY KEY,

        /* An WELCHER Messe — und an welchem ihrer Vorkommen. */
        item_id           uniqueidentifier NOT NULL,
        occurrence_at     datetimeoffset(7) NOT NULL,

        /*
            Die Reihenfolge, in der vorgelesen wird. Sie steht hier und ergibt
            sich nicht aus der Anlegezeit: wer eine Intention nachtraegt, will
            sie nicht zwangslaeufig am Ende haben.
        */
        ordinal           int NOT NULL CONSTRAINT df_rc_mass_intention_ord DEFAULT (0),

        /* Was vorgelesen wird. Offen — siehe Kopf. */
        text_public       nvarchar(400) NOT NULL,

        /*
            Wer gegeben hat und was. Versiegelt unter dem Epochenschluessel des
            Bereichs, so wie die uebrigen inneren Angaben der Pfarrei.

            epoch ist NULL, solange nichts Versiegeltes dasteht — eine Zeile,
            die eine Epoche nennt, aber nichts unter ihr traegt, behauptet
            einen Schluesselbedarf, den es nicht gibt.
        */
        epoch             int NULL,
        giver_sealed      varbinary(2048) NULL,
        offering_sealed   varbinary(1024) NULL,

        /*
            'accepted'  — angenommen, wird gelesen
            'cancelled' — zurueckgezogen; bleibt stehen, damit die Kanzlei
                          sieht, dass da einmal etwas war
            'celebrated'— gefeiert
        */
        status            nvarchar(20) NOT NULL
                          CONSTRAINT df_rc_mass_intention_status DEFAULT (N'accepted'),

        created_by_role_id uniqueidentifier NULL,
        created_at        datetimeoffset(7) NOT NULL,
        updated_at        datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_mass_intention_item
            FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),

        CONSTRAINT ck_rc_mass_intention_status
            CHECK (status IN (N'accepted', N'cancelled', N'celebrated')),

        /*
            Ein Text, der nur aus Leerraum besteht, wird vorgelesen als
            Schweigen — und sieht in der Liste aus wie ein Fehler, den niemand
            zuordnen kann.
        */
        CONSTRAINT ck_rc_mass_intention_text
            CHECK (LEN(LTRIM(RTRIM(text_public))) > 0),

        /*
            Versiegeltes ohne Epoche liesse sich nie wieder oeffnen, und eine
            Epoche ohne Versiegeltes ist eine leere Behauptung. Beides
            zusammen oder keines von beiden.
        */
        CONSTRAINT ck_rc_mass_intention_epoch
            CHECK ((epoch IS NULL AND giver_sealed IS NULL AND offering_sealed IS NULL)
                OR (epoch IS NOT NULL))
    );
END
GO

/*
    Gefragt wird immer nach EINER Messe an EINEM Tag — beim Aushang, beim
    Vorlesen, in der Kanzlei. Genau danach ist sortiert.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_mass_intention_at')
BEGIN
    CREATE INDEX ix_rc_mass_intention_at
        ON dbo.rc_mass_intention (item_id, occurrence_at, ordinal);
END
GO
