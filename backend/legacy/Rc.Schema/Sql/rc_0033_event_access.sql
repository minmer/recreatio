/*
    Der persoenliche Zugang — und was sonst noch aus dem alten Modul fehlte.

    =========================================================================
    1 · DER PERSOENLICHE LINK
    =========================================================================

    Im alten Modul ist er das Herzstueck: ein Teilnehmer ohne Konto bekommt eine
    Adresse, und die oeffnet GENAU die internen Seiten, die ihm zugeteilt wurden.
    Kein Rechteleiter, keine Rollen — eine Zeile je Seite, und ihr Fehlen ist die
    Absage.

    rc hatte dafuer bisher nur den Anmeldebeleg. Der taugt, um zu sagen „ich bin
    der, der sich angemeldet hat" — aber nicht, um jemandem eine Seite zu OEFFNEN,
    die verschluesselt liegt. Fuer das Zweite braucht es einen Schluessel.

    -------------------------------------------------------------------------
    WIE DER SCHLUESSEL AN DEN LINK KOMMT
    -------------------------------------------------------------------------

    Der Zugang traegt den Epochenschluessel des Veranstaltungsbereichs — aber
    verschlossen unter einem Schluessel, der aus dem TOKEN abgeleitet wird.

        token_sha256        zum Nachschlagen der Zeile
        epoch_key_sealed    Seal(HKDF(token), aad, Epochenschluessel)

    Beides zusammen ist der ganze Trick, und beide Haelften braucht es:

      * Der Abdruck erlaubt das Finden, verraet aber den Schluessel nicht —
        aus SHA-256 laesst sich das Token nicht zurueckrechnen.

      * Die Huelle ist ohne Token nicht zu oeffnen. Wer die Datenbank
        vollstaendig besitzt, hat Abdruecke und Huellen und kommt an keine
        einzige interne Seite.

    Der Dienst sieht den Epochenschluessel fuer die Dauer einer Anfrage — genau
    wie bei einem angemeldeten Mitglied, dessen Schluessel er ebenso kurz in der
    Hand hat. Etwas anderes waere gelogen: er MUSS entschluesseln, um die Seite
    auszuliefern.

    -------------------------------------------------------------------------
    WAS DER LINK SONST TRAEGT
    -------------------------------------------------------------------------

    <b>Zuteilungen</b> (`rc_event_access_note`) — die persoenliche Angabe:
    „Twoja grupa: 3", „Zbiórka: 7:40, brama B". Im alten Modul die stillste gute
    Idee des ganzen Teils: EINE Seite sagt jedem Leser etwas anderes, ohne dass
    es je Seite eine Fassung braucht.

    <b>`contact_verified_at`</b> — absichtlich getrennt von der Zaehlung der
    Aufrufe. Das Token reist an genau eine Stelle: an die Nummer, an die der
    Veranstalter es geschickt hat. Das ERSTE Oeffnen beweist damit, dass diese
    Nummer den Menschen erreicht. Aufrufe zaehlen Besuche und sagen nichts.

    =========================================================================
    2 · WAS DIE SEITE UEBER SICH SELBST WEISS
    =========================================================================

    `kind` — oeffentlich oder intern — stand in rc nirgends. Abgeleitet wurde es
    daraus, ob alle Teile versiegelt sind. Das ist als ANZEIGE richtig, taugt
    aber nicht als Absicht: eine noch leere interne Seite haette als oeffentlich
    gegolten, und die erste Zuteilung waere ins Leere gegangen.

    =========================================================================
    3 · KLEINERES, DAS DAS ALTE MODUL KONNTE
    =========================================================================

    `is_hidden` an der Anmeldung: beiseitegelegt, ohne vernichtet zu sein. Sie
    faellt aus Zaehlung und Arbeitsliste, die Antworten bleiben, und sie kommt
    zurueck. Loeschen ist die andere, unwiderrufliche Sache.

    `sms_template` an der Sammlung: EINE Nachricht fuer alles, was darunter
    verschickt wird. Zwanzig Einladungen sagen sonst zwanzig verschiedene Dinge.
*/

/* -------------------------------------------------------------------------
   1 · Der persoenliche Zugang
   ------------------------------------------------------------------------- */

IF OBJECT_ID('dbo.rc_event_access', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_access
    (
        id            uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_access PRIMARY KEY,
        event_id      uniqueidentifier NOT NULL,

        /*
            SHA-256 des Tokens. Zum NACHSCHLAGEN, nicht zum Oeffnen: aus ihm
            laesst sich das Token nicht zurueckrechnen, also auch der
            Ableitungsschluessel nicht.
        */
        token_sha256  varbinary(32) NOT NULL,

        /*
            Der Epochenschluessel des Bereichs, verschlossen unter einem aus dem
            Token abgeleiteten Schluessel. Ohne Token unbrauchbar — auch fuer
            den, der die ganze Tabelle hat.
        */
        epoch_key_sealed varbinary(max) NOT NULL,
        epoch            int NOT NULL,

        /* Wem er gehoert. Jawtext: der Veranstalter fuehrt damit seine Liste. */
        recipient_name    nvarchar(200) NOT NULL,
        recipient_contact nvarchar(200) NULL,

        /* Die Anmeldung, aus der er entstand — wenn es eine gab. */
        registration_id uniqueidentifier NULL,

        /* 'active' | 'revoked' — zurueckgenommen, nicht geloescht. */
        status        nvarchar(16) NOT NULL
            CONSTRAINT df_rc_event_access_status DEFAULT N'active',

        /* Steht auf SEINER Seite. */
        personal_note nvarchar(1000) NULL,
        /* Verlaesst die Verwaltung nie. */
        internal_note nvarchar(1000) NULL,

        /*
            Das erste Oeffnen. Getrennt von der Zaehlung, weil es etwas anderes
            beweist: dass die Nummer, an die geschickt wurde, den Menschen
            erreicht.
        */
        contact_verified_at datetimeoffset(7) NULL,
        view_count          int NOT NULL CONSTRAINT df_rc_event_access_views DEFAULT 0,
        last_viewed_at      datetimeoffset(7) NULL,

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT ck_rc_event_access_status CHECK (status IN (N'active', N'revoked')),
        CONSTRAINT fk_rc_event_access_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id)
    );

    /* Nachschlagen geht ueber den Abdruck — und er ist eindeutig. */
    CREATE UNIQUE INDEX ux_rc_event_access_token ON dbo.rc_event_access (token_sha256);
    CREATE INDEX ix_rc_event_access_event ON dbo.rc_event_access (event_id, created_at DESC);
END
GO

/*
    Welche Seite dieser Zugang oeffnet. EINE Zeile je Seite — ihr FEHLEN ist die
    Absage. Kein Rechteleiter, nichts zu vererben, nichts zu missverstehen.
*/
IF OBJECT_ID('dbo.rc_event_access_page', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_access_page
    (
        id        uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_access_page PRIMARY KEY,
        access_id uniqueidentifier NOT NULL,
        page_id   uniqueidentifier NOT NULL,

        CONSTRAINT fk_rc_event_access_page_access
            FOREIGN KEY (access_id) REFERENCES dbo.rc_event_access (id),
        CONSTRAINT fk_rc_event_access_page_page
            FOREIGN KEY (page_id) REFERENCES dbo.rc_event_page (id)
    );

    CREATE UNIQUE INDEX ux_rc_event_access_page ON dbo.rc_event_access_page (access_id, page_id);
END
GO

/*
    Die persoenliche Angabe: „Twoja grupa: 3", „Zbiórka: 7:40, brama B".

    Damit sagt EINE Seite jedem Leser etwas anderes, ohne dass es je Leser eine
    Fassung braucht. Im alten Modul die stillste gute Idee des ganzen Teils.
*/
IF OBJECT_ID('dbo.rc_event_access_note', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_access_note
    (
        id         uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_access_note PRIMARY KEY,
        access_id  uniqueidentifier NOT NULL,
        sort_order int NOT NULL CONSTRAINT df_rc_event_access_note_sort DEFAULT 0,
        label      nvarchar(160) NOT NULL,
        value      nvarchar(600) NOT NULL,

        CONSTRAINT fk_rc_event_access_note_access
            FOREIGN KEY (access_id) REFERENCES dbo.rc_event_access (id)
    );

    CREATE INDEX ix_rc_event_access_note ON dbo.rc_event_access_note (access_id, sort_order);
END
GO

/* -------------------------------------------------------------------------
   2 · Was die Seite ueber sich selbst weiss
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_event_page', 'kind') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event_page ADD
        /*
            'public' | 'internal'. ABSICHT, nicht Ableitung: eine noch leere
            interne Seite galt bisher als oeffentlich, weil kein Teil auf ihr
            versiegelt war — und die erste Zuteilung waere ins Leere gegangen.
        */
        kind        nvarchar(16) NULL,

        /* Kurz, fuer den Umschalter. Der Titel ist oft zu lang dafuer. */
        menu_label  nvarchar(60) NULL,
        description nvarchar(600) NULL;
END
GO

/* Alles Vorhandene ist oeffentlich: so war es gemeint, als es entstand. */
UPDATE dbo.rc_event_page SET kind = N'public' WHERE kind IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_event_page_kind')
BEGIN
    ALTER TABLE dbo.rc_event_page
        ADD CONSTRAINT ck_rc_event_page_kind CHECK (kind IN (N'public', N'internal'));
END
GO

/* -------------------------------------------------------------------------
   3 · Kleineres
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_event_registration', 'is_hidden') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event_registration ADD
        is_hidden bit NOT NULL CONSTRAINT df_rc_event_registration_hidden DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.rc_event_collection', 'sms_template') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event_collection ADD
        /*
            EINE Nachricht fuer alles, was unter dieser Sammlung verschickt wird.
            Platzhalter: {imie}, {wydarzenie}, {link}. Ohne sie sagen zwanzig
            Einladungen zwanzig verschiedene Dinge.
        */
        sms_template nvarchar(600) NULL;
END
GO

IF COL_LENGTH('dbo.rc_event', 'theme_json') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD theme_json nvarchar(max) NULL;
END
GO
