/*
    Der individuelle Zugang — und die Menschen, die darin handeln.

    =========================================================================
    1. WAS HIER ABGERAEUMT WIRD, UND WARUM
    =========================================================================

    0002 legte `app.body` an: Organisation, Gruppe und Ereignis als eine Sache.
    0003 legte darauf eine zweite Seitenmaschine (`page`, `page_part`,
    `page_field`). 0005 haengte Annahme, Zugang und Anmeldung daran.

    Keine dieser Tabellen hat je eine Zeile getragen, und keine wird von einer
    einzigen Zeile C# angefasst. Inzwischen gilt die Dreiachsenregel:

        Bereiche  sind benannte Schluessel mit Epochen
        Rollen    halten Schluessel — Personen, Gruppen, Aemter
        Seiten    haben ihre eigene Hierarchie (`app.slug`)

        Keine besitzt eine andere.

    `app.body` verstiess dagegen in einer einzigen Zeile: es trug `area_id`,
    `office_role_id`, `member_role_id` UND einen eigenen `slug`. Es band damit
    alle drei Achsen aneinander — genau das, was die Regel verbietet.

    Und `page`/`page_part`/`page_field` sind ein zweites Mal das, was
    `slug_page`/`slug_part` schon sind. Zwei Seitenmaschinen heisst: dieselbe
    Tatsache an zwei Stellen, und eine davon ist immer die veraltete.

    Deshalb faellt beides. Nicht umgehaengt, sondern neu gebaut: die Tabellen
    sind leer, und eine leere Tabelle umzuhaengen ist mehr Arbeit als sie neu
    zu schreiben — mit dem Nachteil, dass die Begruendung in der alten Form
    stehen bliebe.

    =========================================================================
    2. WAS AUS 0003 MITKOMMT — UND WARUM ES MITKOMMEN MUSS
    =========================================================================

    0003 sagte es, und es gilt unveraendert:

        „Laege die Feldliste als JSON im Baustein, haette eine Antwort keinen
        Anker: man aenderte die Reihenfolge, und alle Antworten meinten etwas
        anderes."

    `app.slug_part` traegt seine Einstellung als undurchsichtiges JSON
    (`config`). Fuer Text und Messplan ist das richtig. Fuer ein FORMULAR ist
    es falsch, denn eine Antwort zeigt auf ein Feld. Also bekommt der Baustein
    Felder als ZEILEN — `app.slug_field` — und die Antwort zeigt darauf.

    =========================================================================
    3. WER FUER DIE DATEN GERADESTEHT
    =========================================================================

    `app.organisation` trug `controller_name` und `controller_address`. Das war
    keine Zier: wer personenbezogene Daten erhebt, muss sagen, WER sie
    verarbeitet und unter welcher Anschrift, und zwar BEVOR jemand etwas
    eingegeben hat.

    Mit `body` faellt die Zeile fort, die Pflicht nicht. Sie zieht auf den
    Bereich um, der die Daten sammelt — und bleibt Klartext, notwendigerweise:
    eine Klausel, die man erst entschluesseln muesste, steht nicht da, wo sie
    stehen muss.

    Nicht jeder Bereich sammelt etwas. Deshalb eine eigene Tabelle und keine
    Spalten: ein Bereich ohne Formular hat keine Zeile, und das ist ehrlicher
    als drei leere Felder an jedem Schluessel der Plattform.

    =========================================================================
    4. DER PLATZ — was „individueller Zugang" heisst
    =========================================================================

    Ein Firmkandidat ist vierzehn und hat kein Konto. Ein Teilnehmer meldet
    sich vom offenen Netz an. Ein Schueler bekommt vom Lehrer eine Seite, auf
    der etwas anderes steht als bei seinem Nachbarn.

    Das ist dreimal dasselbe Ding: EIN PLATZ in einem Bereich, mit eigenem
    Schluessel, erreichbar ueber einen Link — und mit zwei Notizfeldern, die in
    verschiedene Richtungen zeigen:

        personal_note_sealed   was der Mensch auf dem Platz sieht
        internal_note_sealed   was die Kanzlei ueber ihn fuehrt

    Der Schueler-Fall braucht deshalb nichts Neues. Er ist die Umkehrung der
    anderen drei: dort schreibt der Mensch herein, hier schreibt das Amt
    hinaus. Dieselbe Zeile traegt beides.

    =========================================================================
    5. WER DARIN HANDELT — das eigentlich Neue
    =========================================================================

    Der Altbestand konnte einen Platz an ein Konto binden (`bind`), und die
    Oberflaeche fragte dabei, WELCHE Person gemeint ist: ein Elternteil mit
    zwei Kindern oeffnet zwei Links, und ohne diese Frage landeten beide bei
    derselben Person — „und weil die Angaben trotzdem aufgingen, faende es
    niemand heraus".

    `app.access_holder` macht daraus eine Liste statt eines Feldes. Ein Platz
    kann gehalten werden von

        niemandem   nur der Link zaehlt — der Vierzehnjaehrige
        einem       er selbst, nachdem er ein Konto hat
        mehreren    beide Eltern; Kandidat UND Pate; Lehrer UND Schueler

    Das Amt steht NICHT in dieser Liste. Wer den Bereich fuehrt, hat ein
    Zertifikat darauf und kommt darueber herein — sonst muesste jede Kanzlei in
    jeden Platz eingetragen werden, und das Austragen vergaesse man.

    =========================================================================
    6. DIE ANGABEN EINES MENSCHEN — und wie eine davon herausgeht
    =========================================================================

    `app.person_value` steht seit 0005 und bleibt unveraendert: Vorname,
    Nachname, Telefon, Geburtstag, Adresse, E-Mail — EINZELN versiegelt unter
    dem Rollenschluessel des Menschen. Es ist „das Einzige, was dem MENSCHEN
    gehoert und keinem Koerper".

    Was fehlte, war die Freigabe. Sie steht jetzt daneben: der Mensch
    versiegelt EINE Angabe unter dem Epochenschluessel EINES Bereichs. Damit

        behaelt er das Original unter seinem eigenen Schluessel,
        bekommt jeder Empfaenger seine eigene Huelle,
        und eine Telefonnummer zieht keinen Geburtstag nach sich.

    Dasselbe Verfahren wie `app.calendar_field` (0020): je Feld ein Bereich,
    je Bereich eine Huelle. Ein zweites Verfahren fuer dieselbe Sache waere
    eine zweite Gelegenheit, es falsch zu machen.

    <b>Der Fremdschluessel auf (role_id, field) ist die eigentliche Sperre.</b>
    Freigeben kann man nur, was man wirklich hat — und die Liste der erlaubten
    Feldnamen steht dadurch an EINER Stelle statt an zweien, die auseinander
    laufen.

    Zuruecknehmen heisst: die Zeile faellt. Was jemand gelesen hat, hat er
    gelesen; das kann keine Datenbank zuruecknehmen, und diese tut auch nicht
    so.
*/

/* -------------------------------------------------------------------------
   1. Abraeumen — Kinder vor Eltern, sonst haelt der Fremdschluessel dagegen
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.registration_value', 'U') IS NOT NULL DROP TABLE app.registration_value;
GO
IF OBJECT_ID('app.registration', 'U') IS NOT NULL DROP TABLE app.registration;
GO
IF OBJECT_ID('app.access_page', 'U') IS NOT NULL DROP TABLE app.access_page;
GO
IF OBJECT_ID('app.access', 'U') IS NOT NULL DROP TABLE app.access;
GO
IF OBJECT_ID('app.intake', 'U') IS NOT NULL DROP TABLE app.intake;
GO
IF OBJECT_ID('app.page_field', 'U') IS NOT NULL DROP TABLE app.page_field;
GO
IF OBJECT_ID('app.page_part', 'U') IS NOT NULL DROP TABLE app.page_part;
GO
IF OBJECT_ID('app.page', 'U') IS NOT NULL DROP TABLE app.page;
GO
/*
    `body_listing` zeigt auf BEIDE — auf den Koerper und auf die Organisation.
    Es faellt deshalb vor beiden, und es stand beim ersten Anlauf nicht in
    dieser Liste: der Fremdschluessel hielt dagegen, und die ganze Wanderung
    fiel zurueck. Sie laeuft in EINER Transaktion, und das ist der Grund, warum
    ein unvollstaendiger Versuch nichts halb Abgeraeumtes hinterlaesst.
*/
IF OBJECT_ID('app.body_listing', 'U') IS NOT NULL DROP TABLE app.body_listing;
GO
IF OBJECT_ID('app.organisation', 'U') IS NOT NULL DROP TABLE app.organisation;
GO
IF OBJECT_ID('app.event', 'U') IS NOT NULL DROP TABLE app.event;
GO
IF OBJECT_ID('app.body', 'U') IS NOT NULL DROP TABLE app.body;
GO

/* -------------------------------------------------------------------------
   2. Wer fuer die Daten geradesteht
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.area_controller', 'U') IS NULL
BEGIN
    CREATE TABLE app.area_controller
    (
        area_id    uniqueidentifier NOT NULL,

        /* Klartext, und das ist der Zweck — siehe Kopf, Abschnitt 3. */
        name       nvarchar(200) NOT NULL,
        address    nvarchar(400) NULL,
        email      nvarchar(200) NULL,

        updated_at datetimeoffset NOT NULL,

        CONSTRAINT pk_area_controller PRIMARY KEY (area_id),
        CONSTRAINT fk_area_controller_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_area_controller_name CHECK (LEN(LTRIM(RTRIM(name))) > 0)
    );
END
GO

/* -------------------------------------------------------------------------
   3. Das Formularfeld — Zeilen, nicht JSON
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.slug_field', 'U') IS NULL
BEGIN
    CREATE TABLE app.slug_field
    (
        id             uniqueidentifier NOT NULL,
        part_id        uniqueidentifier NOT NULL,

        kind           nvarchar(24) NOT NULL,
        position       int          NOT NULL,

        /*
            Auch die BESCHRIFTUNG ist versiegelt, und die Auswahlliste erst
            recht: eine Liste moeglicher Antworten sagt oft mehr als die Frage.
        */
        label_sealed   varbinary(max) NOT NULL,
        help_sealed    varbinary(max) NULL,
        options_sealed varbinary(max) NULL,
        epoch          int NOT NULL,

        is_required    bit NOT NULL CONSTRAINT df_slug_field_required DEFAULT (0),
        is_half_width  bit NOT NULL CONSTRAINT df_slug_field_half     DEFAULT (0),

        /*
            Woraus Name und Kontakt zu lesen sind. Ohne diese Angabe muesste
            die Kanzlei raten, welches von vierzehn Feldern der Name ist.
        */
        identity_role  nvarchar(16) NOT NULL CONSTRAINT df_slug_field_identity DEFAULT (N'none'),

        created_at     datetimeoffset NOT NULL,

        CONSTRAINT pk_slug_field PRIMARY KEY (id),
        CONSTRAINT fk_slug_field_part FOREIGN KEY (part_id) REFERENCES app.slug_part (id),
        CONSTRAINT ck_slug_field_identity CHECK (identity_role IN (N'none', N'name', N'contact')),
        CONSTRAINT ck_slug_field_epoch CHECK (epoch >= 1)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_field_part')
    CREATE INDEX ix_slug_field_part ON app.slug_field (part_id, position);
GO

/* -------------------------------------------------------------------------
   4. Die Annahme — am BEREICH, privat beim AMT
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.intake', 'U') IS NULL
BEGIN
    CREATE TABLE app.intake
    (
        area_id            uniqueidentifier NOT NULL,

        /* Geht MIT dem Formular hinaus. Damit laesst sich verschliessen und nichts oeffnen. */
        public_key         varbinary(max) NOT NULL,

        /*
            Unter dem Schluessel des AMTES, nicht unter einer Epoche.

            0005 nannte den Grund, und er gilt weiter: lag sie unter dem
            Epochenschluessel des Bereichs, konnte jeder Helfer saemtliche
            Anmeldungen lesen, ohne dass ihm jemand etwas gegeben haette. Es
            folgte aus der Mitgliedschaft — und Mitgliedschaft ist keine
            Befugnis.

            Ein Schnitt der Epoche macht sie ausserdem nicht unbrauchbar.
        */
        private_key_sealed varbinary(max) NOT NULL,
        sealed_for_role_id uniqueidentifier NOT NULL,

        created_at         datetimeoffset NOT NULL,

        CONSTRAINT pk_intake PRIMARY KEY (area_id),
        CONSTRAINT fk_intake_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_intake_role FOREIGN KEY (sealed_for_role_id) REFERENCES app.role (id)
    );
END
GO

/* -------------------------------------------------------------------------
   5. Der Platz
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.access', 'U') IS NULL
BEGIN
    CREATE TABLE app.access
    (
        id                   uniqueidentifier NOT NULL,
        area_id              uniqueidentifier NOT NULL,

        /*
            Der Link IST der Ausweis. Gespeichert wird nur sein Abdruck — wer
            die Datenbank liest, sieht, DASS es einen Platz gibt, und kommt
            nicht hinein.

            Das Geheimnis selbst steht hinter der Raute und geht nie an den
            Dienst. Eine bewusste Abweichung von der Regel, dass Geheimnisse
            nicht in Adressen stehen: so ein Link wird per SMS verschickt, und
            einer, den man abtippen muesste, wird stattdessen abfotografiert.
        */
        token_sha256         varbinary(32)  NOT NULL,

        /* Ohne Konto gibt es keine Rolle, an die man zuteilen koennte. */
        epoch_key_sealed     varbinary(max) NOT NULL,
        epoch                int NOT NULL,

        /* Offen, weil der Ausstellende ihn zuordnen muss, BEVOR er ihn schickt. */
        recipient_name       nvarchar(200) NULL,

        /* Die zwei Richtungen — siehe Kopf, Abschnitt 4. */
        personal_note_sealed varbinary(max) NULL,
        internal_note_sealed varbinary(max) NULL,

        status               nvarchar(16) NOT NULL CONSTRAINT df_access_status DEFAULT (N'active'),
        view_count           int NOT NULL CONSTRAINT df_access_views DEFAULT (0),

        created_by_role_id   uniqueidentifier NULL,
        created_at           datetimeoffset NOT NULL,
        expires_at           datetimeoffset NULL,
        revoked_at           datetimeoffset NULL,

        CONSTRAINT pk_access PRIMARY KEY (id),
        CONSTRAINT fk_access_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_access_role FOREIGN KEY (created_by_role_id) REFERENCES app.role (id),
        CONSTRAINT ck_access_status CHECK (status IN (N'active', N'revoked', N'spent')),
        CONSTRAINT ck_access_epoch CHECK (epoch >= 1)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_access_token')
    CREATE UNIQUE INDEX ux_access_token ON app.access (token_sha256);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_area')
    CREATE INDEX ix_access_area ON app.access (area_id, created_at DESC);
GO

/*
    Welche Seiten dieser Platz oeffnet. Eine Zeile je Seite, und ihr Fehlen ist
    die Absage — die einfachste Regel, die es gibt, und deshalb die, bei der
    sich niemand verrechnet.
*/
IF OBJECT_ID('app.access_slug', 'U') IS NULL
BEGIN
    CREATE TABLE app.access_slug
    (
        access_id uniqueidentifier NOT NULL,
        slug_id   uniqueidentifier NOT NULL,

        CONSTRAINT pk_access_slug PRIMARY KEY (access_id, slug_id),
        CONSTRAINT fk_access_slug_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_access_slug_slug   FOREIGN KEY (slug_id)   REFERENCES app.slug (id)
    );
END
GO

/* -------------------------------------------------------------------------
   6. Wer in dem Platz handelt
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.access_holder', 'U') IS NULL
BEGIN
    CREATE TABLE app.access_holder
    (
        access_id        uniqueidentifier NOT NULL,

        /*
            Eine Rolle der Art `person` — ein MENSCH, nicht ein Amt. Das Amt
            kommt ueber sein Zertifikat auf den Bereich herein und steht
            deshalb nicht hier; stuende es hier, muesste man es aus jedem Platz
            wieder austragen, und genau das vergaesse man.
        */
        role_id          uniqueidentifier NOT NULL,

        added_by_role_id uniqueidentifier NULL,
        since            datetimeoffset NOT NULL,

        /* Gesetzt statt geloescht: wer einmal handeln durfte, hat gehandelt. */
        until            datetimeoffset NULL,

        CONSTRAINT pk_access_holder PRIMARY KEY (access_id, role_id),
        CONSTRAINT fk_access_holder_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_access_holder_role   FOREIGN KEY (role_id)   REFERENCES app.role (id),
        CONSTRAINT fk_access_holder_by     FOREIGN KEY (added_by_role_id) REFERENCES app.role (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_access_holder_role')
    CREATE INDEX ix_access_holder_role ON app.access_holder (role_id) WHERE until IS NULL;
GO

/* -------------------------------------------------------------------------
   7. Die Anmeldung
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.registration', 'U') IS NULL
BEGIN
    CREATE TABLE app.registration
    (
        id           uniqueidentifier NOT NULL,
        part_id      uniqueidentifier NOT NULL,

        /*
            Drei Wege herein, und mindestens einer muss dastehen:

                access_id     ueber den Link, ohne Konto
                role_id       ueber ein Konto
                claim_sha256  die Quittung einer Selbstanmeldung — der Beweis,
                              dass sie einem gehoert, zum Aendern oder
                              Zurueckziehen. Gespeichert wird nur der Abdruck.
        */
        access_id    uniqueidentifier NULL,
        role_id      uniqueidentifier NULL,
        claim_sha256 varbinary(32)    NULL,

        submitted_at datetimeoffset NOT NULL,
        withdrawn_at datetimeoffset NULL,
        is_hidden    bit NOT NULL CONSTRAINT df_registration_hidden DEFAULT (0),

        CONSTRAINT pk_registration PRIMARY KEY (id),
        CONSTRAINT fk_registration_part   FOREIGN KEY (part_id)   REFERENCES app.slug_part (id),
        CONSTRAINT fk_registration_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_registration_role   FOREIGN KEY (role_id)   REFERENCES app.role (id),

        -- Eine Anmeldung ohne jede Spur waere eine, zu der niemand mehr gehoert.
        CONSTRAINT ck_registration_who
            CHECK (access_id IS NOT NULL OR role_id IS NOT NULL OR claim_sha256 IS NOT NULL)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_registration_part')
    CREATE INDEX ix_registration_part ON app.registration (part_id, submitted_at);
GO

/*
    Die Werte in eigenen Zeilen, nicht als ein Klumpen: ein Klumpen liesse sich
    gegen den eines anderen tauschen, ohne dass etwas auffiele.

    Jede Einsendung bringt ihren EIGENEN Sitzungsschluessel mit, verpackt unter
    der oeffentlichen Haelfte des Annahmepaares. Deshalb `wrapped_key` je Zeile
    und nicht eine Epoche am Formular.
*/
IF OBJECT_ID('app.registration_value', 'U') IS NULL
BEGIN
    CREATE TABLE app.registration_value
    (
        registration_id uniqueidentifier NOT NULL,
        field_id        uniqueidentifier NOT NULL,

        value_sealed    varbinary(max) NOT NULL,
        wrapped_key     varbinary(max) NOT NULL,

        CONSTRAINT pk_registration_value PRIMARY KEY (registration_id, field_id),
        CONSTRAINT fk_registration_value_reg   FOREIGN KEY (registration_id) REFERENCES app.registration (id),
        CONSTRAINT fk_registration_value_field FOREIGN KEY (field_id)        REFERENCES app.slug_field (id)
    );
END
GO

/* -------------------------------------------------------------------------
   8. Die Freigabe einer einzelnen Angabe
   ------------------------------------------------------------------------- */

IF OBJECT_ID('app.person_release', 'U') IS NULL
BEGIN
    CREATE TABLE app.person_release
    (
        role_id     uniqueidentifier NOT NULL,
        field       nvarchar(32)     NOT NULL,

        /* AN WEN. Ein Bereich, kein Mensch: Menschen kommen und gehen, der Schluessel bleibt. */
        area_id     uniqueidentifier NOT NULL,
        epoch       int              NOT NULL,

        /* Dieselbe Angabe, neu versiegelt — nicht der Schluessel des Menschen. */
        sealed_blob varbinary(max)   NOT NULL,

        released_at datetimeoffset   NOT NULL,

        CONSTRAINT pk_person_release PRIMARY KEY (role_id, field, area_id),

        /*
            DIE EIGENTLICHE SPERRE. Freigeben kann man nur, was man hat — und
            die Liste der erlaubten Feldnamen steht dadurch allein an
            `app.person_value` und nicht ein zweites Mal hier.
        */
        CONSTRAINT fk_person_release_value
            FOREIGN KEY (role_id, field) REFERENCES app.person_value (role_id, field),

        CONSTRAINT fk_person_release_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT ck_person_release_epoch CHECK (epoch >= 1)
    );
END
GO

/* „Was hat dieser Bereich ueber Menschen" — die Frage der Kanzlei. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_person_release_area')
    CREATE INDEX ix_person_release_area ON app.person_release (area_id, field);
GO
