/*
    Messen und ihre Intentionen.

    -------------------------------------------------------------------------
    WARUM DIE MESSE HIER EINE EIGENE ZEILE IST — UND IM ALTBESTAND NICHT
    -------------------------------------------------------------------------

    Der Altbestand sagt ausdruecklich: „Msza to wpis kalendarza. Nie ma osobnej
    tabeli mszy i nie powinno jej byc." Das war dort richtig, weil es einen
    Kalender GAB: Zeit, Wiederholung und Ausnahmen standen schon da, und eine
    zweite Tabelle haette sie verdoppelt.

    Hier gibt es keinen Kalender. Damit dreht sich das Argument um: einen
    allgemeinen Kalender allein zu bauen, damit Messen darin liegen koennen,
    ergaebe einen Kalender, den sonst niemand benutzt — und die Messe waere
    trotzdem erst danach fertig.

    Deshalb traegt diese Zeile GENAU DIE FELDER eines Kalendereintrags:
    starts_at, minutes, repeat_kind, repeat_weekdays, repeat_until, item_type,
    title_public. Kommt der Kalender, wandert sie als Ganzes hinein, ohne dass
    eine Intention ihre Adresse verliert.

    -------------------------------------------------------------------------
    WARUM DIE INTENTION AM VORKOMMEN HAENGT UND NICHT AN DER REIHE
    -------------------------------------------------------------------------

    „Werktags 18 Uhr" ist EINE Zeile mit vielen Vorkommen. Die Intention gilt
    aber fuer den Dienstag, nicht fuer die Reihe: am Mittwoch ist es eine
    andere. Die Adresse ist deshalb (item_id, occurrence_at).

    occurrence_at ist der URSPRUENGLICHE Beginn des Vorkommens, nicht der
    verschobene. Wird eine Messe einmal um eine Stunde verlegt, behaelt sie
    ihre Intentionen — sonst haengen sie an einer Adresse, die die Oberflaeche
    beim naechsten Aufruf anders schreibt.

    -------------------------------------------------------------------------
    WARUM DER TEXT IM KLARTEXT STEHT
    -------------------------------------------------------------------------

    Eine Intention wird in der Kirche VORGELESEN und im Schaukasten
    ausgehaengt. Sie zu versiegeln hiesse, das Modul gegen seinen Zweck zu
    bauen — die oeffentliche Seite haette gar keinen Schluessel dafuer.

    Geber und Gabe sind etwas anderes; die stehen auf keinem Zettel an der
    Tuer. Sie fehlen hier ABSICHTLICH: der Altbestand versiegelt sie unter dem
    Epochenschluessel eines Bereichs, den es hier nicht gibt, und Spalten
    anzulegen, die nichts fuellt, waere ein Versprechen, das die Zeile nicht
    haelt. Sie kommen mit dem Rollenschluessel nach, wenn sie gebraucht werden.

    -------------------------------------------------------------------------
    EINZELN ODER ZUSAMMENGELEGT — KEINE BESCHRIFTUNG
    -------------------------------------------------------------------------

    EINZELN (single): mehrere Intentionen in einer Messe heissen, dass JEDER
    PRIESTER seine eigene hat — zwei einzelne sind zwei Konzelebranten.

    ZUSAMMENGELEGT (collective): EIN Priester liest mehrere zusammen.

    Der Unterschied entscheidet, wie viele Priester gebraucht werden. Wer beide
    als „mehrere Intentionen" fuehrt, kann die Frage „brauche ich noch
    jemanden" nicht mehr beantworten — deshalb haelt der eindeutige Index unten
    sie auseinander.
*/

/* -------------------------------------------------------------------------
   1. Der Gottesdienst — Messe oder Beichtzeit
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.mass_item', 'U') IS NULL
BEGIN
    CREATE TABLE app.mass_item (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_mass_item PRIMARY KEY,

        /* An WELCHER Adresse. Der Messplan gehoert der Seite, die ihn zeigt. */
        slug_id       uniqueidentifier NOT NULL,

        /*
            Die Beichte ist dasselbe Gebilde — wiederkehrend, oeffentlich, in
            der Kirche — mit einem Unterschied: sie hat KEINE Intentionen. Die
            Art steht deshalb hier und nicht im Titel; ein Titel ist Text, den
            jemand morgen anders schreibt, und dann stuende die Beichte im
            Aushang zwischen den Messen.
        */
        item_type     nvarchar(20) NOT NULL
                      CONSTRAINT df_mass_item_type DEFAULT (N'mass'),

        /* Was im Schaukasten steht. Leer heisst: nur die Uhrzeit. */
        title_public  nvarchar(200) NULL,

        /* Der Beginn des ERSTEN Vorkommens. Die Uhrzeit gilt fuer alle. */
        starts_at     datetimeoffset(7) NOT NULL,

        /*
            IN WELCHER ZEIT DIE REIHE LAEUFT.

            Eine Messe wiederholt sich nach der UHR AN DER WAND, nicht nach
            einem festen Abstand zu UTC. Ohne diese Spalte bliebe beim
            Weiterzaehlen der urspruengliche Versatz stehen: eine Messe um
            18:00+02:00 stuende ab Ende Oktober um 17:00 Ortszeit da — jedes
            Jahr zweimal, und bemerkt wuerde es in einer leeren Kirche.

            Der Altbestand fuehrt sie am Kalender (Europe/Warsaw) aus genau
            diesem Grund. Hier haengt sie an der Reihe selbst, weil es den
            Kalender noch nicht gibt.
        */
        time_zone     nvarchar(60) NOT NULL
                      CONSTRAINT df_mass_item_tz DEFAULT (N'Europe/Warsaw'),

        minutes       int NOT NULL CONSTRAINT df_mass_item_minutes DEFAULT (45),

        repeat_kind   nvarchar(20) NOT NULL
                      CONSTRAINT df_mass_item_repeat DEFAULT (N'none'),

        /* Bitmaske: pn=1, wt=2, sr=4, cz=8, pt=16, sb=32, nd=64. */
        repeat_weekdays int NULL,

        repeat_until  datetimeoffset(7) NULL,

        created_by_role_id uniqueidentifier NULL,
        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_mass_item_slug
            FOREIGN KEY (slug_id) REFERENCES app.slug (id),

        CONSTRAINT ck_mass_item_type
            CHECK (item_type IN (N'mass', N'confession')),

        CONSTRAINT ck_mass_item_repeat
            CHECK (repeat_kind IN (N'none', N'weekly', N'daily')),

        /* Eine Messe von null Minuten faende nicht statt. */
        CONSTRAINT ck_mass_item_minutes
            CHECK (minutes BETWEEN 5 AND 480),

        /*
            EINE REIHE MUSS EIN ENDE HABEN.

            Eine Wiederholung ohne Ende laesst sich nie vollstaendig ausrechnen,
            und ein Plan „bis auf Widerruf" steht nach Jahren falsch da, ohne
            dass es jemandem auffaellt. Ohne Wiederholung darf umgekehrt kein
            Ende dastehen — das waere ein Ende von nichts.
        */
        CONSTRAINT ck_mass_item_until
            CHECK ((repeat_kind = N'none' AND repeat_until IS NULL)
                OR (repeat_kind <> N'none' AND repeat_until IS NOT NULL)),

        /*
            Eine leere Maske ergaebe eine Reihe, die nie faellt: der Eintrag
            steht da, die Messe findet nicht statt, und nichts erklaert es.
        */
        CONSTRAINT ck_mass_item_weekdays
            CHECK ((repeat_kind <> N'weekly' AND repeat_weekdays IS NULL)
                OR (repeat_kind = N'weekly' AND repeat_weekdays BETWEEN 1 AND 127))
    );
END
GO

/*
    Gefragt wird immer „was steht an DIESER Adresse in DIESEM Zeitraum" — beim
    Aushang, beim Eintragen, beim Drucken. Genau danach ist sortiert.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_mass_item_slug')
BEGIN
    CREATE INDEX ix_mass_item_slug ON app.mass_item (slug_id, starts_at);
END
GO

/* -------------------------------------------------------------------------
   2. Die Intentionen
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.mass_intention', 'U') IS NULL
BEGIN
    CREATE TABLE app.mass_intention (
        id            uniqueidentifier NOT NULL
                      CONSTRAINT pk_mass_intention PRIMARY KEY,

        /* An WELCHER Messe — und an welchem ihrer Vorkommen. */
        item_id       uniqueidentifier NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,

        /*
            Die Reihenfolge, in der vorgelesen wird. Sie steht hier und ergibt
            sich nicht aus der Anlegezeit: wer eine Intention nachtraegt, will
            sie nicht zwangslaeufig am Ende haben.
        */
        ordinal       int NOT NULL CONSTRAINT df_mass_intention_ord DEFAULT (0),

        /* Was vorgelesen wird. Offen — siehe Kopf. */
        text_public   nvarchar(400) NOT NULL,

        kind          nvarchar(20) NOT NULL
                      CONSTRAINT df_mass_intention_kind DEFAULT (N'single'),

        /*
            NULL heisst: noch nicht zugeteilt. Das ist ein echter Zustand und
            kein fehlender Wert — eine Intention wird angenommen, lange bevor
            feststeht, wer sie liest.
        */
        celebrant_role_id uniqueidentifier NULL,

        /*
            'accepted'   — angenommen, wird gelesen
            'cancelled'  — zurueckgezogen; bleibt stehen, damit die Kanzlei
                           sieht, dass da einmal etwas war
            'celebrated' — gefeiert
        */
        status        nvarchar(20) NOT NULL
                      CONSTRAINT df_mass_intention_status DEFAULT (N'accepted'),

        created_by_role_id uniqueidentifier NULL,
        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_mass_intention_item
            FOREIGN KEY (item_id) REFERENCES app.mass_item (id),

        CONSTRAINT fk_mass_intention_celebrant
            FOREIGN KEY (celebrant_role_id) REFERENCES app.role (id),

        CONSTRAINT ck_mass_intention_kind
            CHECK (kind IN (N'single', N'collective')),

        CONSTRAINT ck_mass_intention_status
            CHECK (status IN (N'accepted', N'cancelled', N'celebrated')),

        /*
            Ein Text aus lauter Leerraum wird vorgelesen als Schweigen — und
            sieht in der Liste aus wie ein Fehler, den niemand zuordnen kann.
        */
        CONSTRAINT ck_mass_intention_text
            CHECK (LEN(LTRIM(RTRIM(text_public))) > 0)
    );
END
GO

/*
    Zwei EINZELNE Intentionen derselben Messe mit demselben Priester gibt es
    nicht — das waere keine zweite Intention, sondern dieselbe Messe zweimal
    gezaehlt.

    Zurueckgezogene zaehlen nicht mit, und ein noch nicht zugeteilter Priester
    auch nicht: sonst liesse sich nur eine einzige Intention ohne Zuteilung
    anlegen. Fuer zusammengelegte gilt die Regel gerade NICHT — dort ist es der
    Punkt, dass einer viele traegt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_mass_intention_celebrant')
BEGIN
    CREATE UNIQUE INDEX uq_mass_intention_celebrant
        ON app.mass_intention (item_id, occurrence_at, celebrant_role_id)
        WHERE kind = N'single'
          AND celebrant_role_id IS NOT NULL
          AND status <> N'cancelled';
END
GO

/*
    Gefragt wird immer nach EINER Messe an EINEM Tag, in Lesereihenfolge.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_mass_intention_at')
BEGIN
    CREATE INDEX ix_mass_intention_at
        ON app.mass_intention (item_id, occurrence_at, ordinal);
END
GO
