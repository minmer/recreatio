/*
    Alles, was dem Veranstaltungsmodul noch fehlte.

    -------------------------------------------------------------------------
    WAS HIER ENTSTEHT UND WARUM ES ZUSAMMENGEHOERT
    -------------------------------------------------------------------------

    Das alte Modul konnte Dinge, die das rc-Modell nicht abbilden konnte, und
    zwar nicht aus Nachlaessigkeit: jedem fehlte eine Tabelle. Ein Skript statt
    acht, weil sie zusammen eine Entscheidung sind — naemlich WER unter einer
    Veranstaltung etwas beitragen darf.

    -------------------------------------------------------------------------
    DIE ANTWORT AUF „WER" — UND WARUM SIE NICHT DER LINK IST
    -------------------------------------------------------------------------

    Im alten Modul hing alles am `AccessLinkId`: ein persoenlicher Link WAR die
    Kennung des Lesers. Wer ihn hatte, war er.

    Hier nicht. Ein Teilnehmer ohne Konto weist sich mit dem BELEG seiner
    Anmeldung aus (`rc_event_registration.claim_sha256`, POST /rc/registrations
    /claim) — dasselbe Verfahren, dieselbe Grenze, aber es existiert schon und
    ist schon durchdacht: der Beleg wird einmal gezeigt, gespeichert wird nur
    sein Abdruck, und wer die Tabelle vollstaendig besitzt, kann damit nichts
    aufrufen.

    Ein zweites Geheimnis daneben zu stellen hiesse: zwei Wege hinein, zwei
    Sperren zu pflegen, und beim naechsten Umbau vergisst jemand den zweiten.
    Deshalb traegt jede Tabelle unten `registration_id` und keine einen Token.

    -------------------------------------------------------------------------
    ANHAENGE BEKOMMEN EINEN ALLGEMEINEN TRAEGER
    -------------------------------------------------------------------------

    `rc_attachment` haengt bisher an einer Nachricht. Bilder und Dateien einer
    Veranstaltung sind aber dieselbe Sache: Geheimtext auf der Platte, Kontingent
    am Konto, Abdruck in der Zeile. Eine zweite Ablage danebenzustellen hiesse,
    dieselben drei Entscheidungen ein zweites Mal zu treffen — und die zweite
    waere die schlechtere, weil sie die erste nicht kennt.

    Also: `owner_kind` + `owner_id`, und `message_id` wird nachgiebig.
*/

/* -------------------------------------------------------------------------
   1 · Anhaenge: vom Nachrichtenanhang zum allgemeinen Anhang
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_attachment', 'owner_kind') IS NULL
BEGIN
    ALTER TABLE dbo.rc_attachment ADD
        /* 'message', 'event_photo', 'event_document' — was die Zeile traegt. */
        owner_kind nvarchar(20) NULL,
        owner_id   uniqueidentifier NULL;
END
GO

/*
    Nachtrag: jeder vorhandene Anhang gehoert einer Nachricht. Ohne diesen
    Schritt stuenden alte Zeilen ohne Traeger da und faenden sich in keiner
    Abfrage wieder, die kuenftig ueber `owner_kind` geht.
*/
UPDATE dbo.rc_attachment
   SET owner_kind = N'message', owner_id = message_id
 WHERE owner_kind IS NULL AND message_id IS NOT NULL;
GO

/*
    `message_id` wird nachgiebig, denn ein Veranstaltungsbild haengt an keiner
    Nachricht. Die Spalte BLEIBT — sie traegt den Fremdschluessel, und ihn
    fallen zu lassen hiesse, die Verknuepfung zu Nachrichten aufzugeben, die
    heute funktioniert.
*/
IF EXISTS (SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('dbo.rc_attachment')
              AND name = 'message_id' AND is_nullable = 0)
BEGIN
    ALTER TABLE dbo.rc_attachment ALTER COLUMN message_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_attachment_owner')
BEGIN
    CREATE INDEX ix_rc_attachment_owner ON dbo.rc_attachment (owner_kind, owner_id)
        WHERE owner_id IS NOT NULL;
END
GO

/* -------------------------------------------------------------------------
   2 · Der Katalog: wonach sich eine Veranstaltung finden laesst
   ------------------------------------------------------------------------- */

/*
    Das alte Modul filterte die Uebersicht nach Art, Zielgruppe und Ort. Diese
    Felder sind STRUKTURIERT und nicht Teil eines Teils, weil der Katalog danach
    sortiert und siebt — aus einem Textabschnitt liesse sich das nur raten.

    Jawtext: der Katalog ist die Seite, die man verschickt, und sie muss ohne
    Konto lesbar sein.
*/
IF COL_LENGTH('dbo.rc_event', 'summary') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD
        /* Anriss fuer die Katalogkarte — nicht der Untertitel auf der Seite. */
        summary       nvarchar(400) NULL,

        /* Die Familie: „Pielgrzymka rowerowa", „Warsztaty muzyczne". Freitext,
           damit eine neue Familie keine Migration braucht; der Katalog baut
           seinen Filter aus den vorhandenen Werten. */
        category      nvarchar(80)  NULL,

        /* Fuer wen: „Mlodziez 16-30", „Rodziny z dziecmi". */
        audience      nvarchar(160) NULL,

        /* JSON-Liste der Hauptorte, in Reihenfolge. Treibt den Ortsfilter. */
        places_json   nvarchar(max) NULL,

        thumbnail_url nvarchar(600) NULL,

        /* Ueberschreibt die aus den Daten gebaute Zeile, wenn sie nicht passt
           („Adwent 2026" statt zweier Daten). */
        date_label    nvarchar(120) NULL;
END
GO

/* -------------------------------------------------------------------------
   3 · Bilder und Dateien
   ------------------------------------------------------------------------- */

/*
    Die BYTES liegen im Anhang (verschluesselt, auf der Platte); hier steht nur,
    was das Bild in der Galerie ausmacht. Getrennt, weil beides verschiedene
    Fristen hat: eine Bildunterschrift wird korrigiert, die Datei nicht.
*/
IF OBJECT_ID('dbo.rc_event_photo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_photo
    (
        id              uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_photo PRIMARY KEY,
        event_id        uniqueidentifier NOT NULL,
        part_id         uniqueidentifier NOT NULL,
        attachment_id   uniqueidentifier NOT NULL,

        /* Wer es hochgeladen hat — die Anmeldung, nicht das Konto: Teilnehmer
           haben meist keines. NULL heisst: jemand aus der Verwaltung. */
        registration_id uniqueidentifier NULL,

        /* Der Name, den der Hochladende angegeben hat. Jawtext, weil er unter
           dem Bild steht; wer nicht genannt werden will, laesst ihn leer. */
        uploader_name   nvarchar(120) NULL,
        caption         nvarchar(400) NULL,

        /* Fuer das Raster: ohne Seitenverhaeltnis springt die Galerie beim
           Laden jedes Bildes. */
        width           int NOT NULL CONSTRAINT df_rc_event_photo_w DEFAULT 0,
        height          int NOT NULL CONSTRAINT df_rc_event_photo_h DEFAULT 0,

        created_at      datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_event_photo_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
        CONSTRAINT fk_rc_event_photo_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id),
        CONSTRAINT fk_rc_event_photo_attachment
            FOREIGN KEY (attachment_id) REFERENCES dbo.rc_attachment (id)
    );

    CREATE INDEX ix_rc_event_photo_part ON dbo.rc_event_photo (part_id, created_at DESC);
END
GO

/*
    Dateien einer Veranstaltung — Programme, Anmeldebogen, Karten. Anders als
    Bilder haengen sie an der VERANSTALTUNG und nicht an einem Teil: dieselbe
    Datei steht oft in zwei Abschnitten, und sie zweimal hochzuladen hiesse,
    sie zweimal zu korrigieren.
*/
IF OBJECT_ID('dbo.rc_event_document', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_document
    (
        id            uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_document PRIMARY KEY,
        event_id      uniqueidentifier NOT NULL,
        attachment_id uniqueidentifier NOT NULL,
        label         nvarchar(200) NULL,
        created_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_event_document_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
        CONSTRAINT fk_rc_event_document_attachment
            FOREIGN KEY (attachment_id) REFERENCES dbo.rc_attachment (id)
    );

    CREATE INDEX ix_rc_event_document_event ON dbo.rc_event_document (event_id, created_at DESC);
END
GO

/* -------------------------------------------------------------------------
   4 · Die Liste: wer was abgehakt hat
   ------------------------------------------------------------------------- */

/*
    Eine Zelle je (Zeile, Spalte). `row_key` ist die Zeile — im alten Modul der
    Schluessel eines Teilnehmers —, `code` die Spalte („zahlung", „rueckfahrt").

    <b>Warum nicht eine Zeile je Teilnehmer mit einer JSON-Spalte.</b> Zwei
    Betreuer haken gleichzeitig ab. Bei einer JSON-Spalte gewinnt der letzte
    Schreiber und der andere Haken verschwindet, ohne dass es jemand merkt.
*/
IF OBJECT_ID('dbo.rc_event_roster', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_roster
    (
        id         uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_roster PRIMARY KEY,
        event_id   uniqueidentifier NOT NULL,
        part_id    uniqueidentifier NOT NULL,
        row_key    nvarchar(120) NOT NULL,
        code       nvarchar(60)  NOT NULL,
        value      nvarchar(400) NULL,

        /* Wer zuletzt angefasst hat — damit sich eine strittige Zelle klaeren
           laesst, ohne die Kette zu bemuehen. */
        updated_by nvarchar(120) NULL,
        updated_at datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_event_roster_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
        CONSTRAINT fk_rc_event_roster_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id)
    );

    /* Eine Zelle gibt es genau einmal. Ohne das entstehen bei zwei gleichzeitigen
       Haken zwei Zeilen, und welche gilt, entscheidet die Sortierung. */
    CREATE UNIQUE INDEX ux_rc_event_roster_cell
        ON dbo.rc_event_roster (part_id, row_key, code);
END
GO

/* -------------------------------------------------------------------------
   5 · Teilnehmerkarte
   ------------------------------------------------------------------------- */

/*
    Was jemand ueber sich angibt, samt Einwilligungen und dem Wortlaut, unter
    dem er sie gegeben hat.

    <b>`clause_text` wird MITGESCHRIEBEN, nicht verwiesen.</b> Die Klausel an
    der Sammlung darf sich aendern; eine Einwilligung gilt aber unter dem Text,
    der damals dastand. Ein Verweis machte aus jeder spaeteren Aenderung eine
    rueckwirkende — und genau das darf sie nicht sein.

    <b>Versiegelt.</b> Anders als die Klausel sind das personenbezogene Daten,
    oft besonderer Kategorien (Ernaehrung, Unvertraeglichkeit). Sie liegen unter
    dem Epochenschluessel des Veranstaltungsbereichs, wie die Antworten einer
    Anmeldung.
*/
IF OBJECT_ID('dbo.rc_event_card', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_card
    (
        id               uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_card PRIMARY KEY,
        event_id         uniqueidentifier NOT NULL,
        part_id          uniqueidentifier NOT NULL,
        registration_id  uniqueidentifier NULL,

        epoch            int NOT NULL,
        data_sealed      varbinary(max) NOT NULL,
        consents_sealed  varbinary(max) NULL,

        /* Der Wortlaut, unter dem eingewilligt wurde. Jawtext: wer nachliest,
           was er unterschrieben hat, braucht keinen Schluessel dafuer. */
        clause_text      nvarchar(max) NULL,

        is_minor         bit NOT NULL CONSTRAINT df_rc_event_card_minor DEFAULT 0,

        /* 'participant' oder 'guardian' — wer unterschrieben hat. */
        signer_role      nvarchar(20) NOT NULL
            CONSTRAINT df_rc_event_card_signer DEFAULT N'participant',

        submitted_at     datetimeoffset(7) NOT NULL,
        updated_at       datetimeoffset(7) NOT NULL,

        CONSTRAINT ck_rc_event_card_signer
            CHECK (signer_role IN (N'participant', N'guardian')),

        CONSTRAINT fk_rc_event_card_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
        CONSTRAINT fk_rc_event_card_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id)
    );

    CREATE INDEX ix_rc_event_card_part ON dbo.rc_event_card (part_id, submitted_at DESC);
END
GO

/* -------------------------------------------------------------------------
   6 · Fortschritt: die Checkliste eines einzelnen Lesers
   ------------------------------------------------------------------------- */

/*
    Was ein Teilnehmer fuer sich abgehakt hat. Eine Zeile je Haken, aus
    demselben Grund wie beim Roster — und weil ein geloeschter Haken dann eine
    geloeschte Zeile ist und kein „false", das sich von „nie gesetzt" nicht
    unterscheiden liesse.
*/
IF OBJECT_ID('dbo.rc_event_progress', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_progress
    (
        id              uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_progress PRIMARY KEY,
        part_id         uniqueidentifier NOT NULL,
        registration_id uniqueidentifier NOT NULL,
        item_key        nvarchar(120) NOT NULL,
        done_at         datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_event_progress_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id)
    );

    CREATE UNIQUE INDEX ux_rc_event_progress_item
        ON dbo.rc_event_progress (part_id, registration_id, item_key);
END
GO

/* -------------------------------------------------------------------------
   7 · Themen: Fragen der Teilnehmer
   ------------------------------------------------------------------------- */

/*
    <b>Warum nicht der Chat.</b> Der Chat setzt Konten und Rollen voraus; hier
    schreibt jemand, der sich zu einem Fest angemeldet hat und sonst nichts mit
    der Plattform zu tun hat. Ihn dafuer ein Konto anlegen zu lassen hiesse, die
    Frage nicht zu stellen.

    Der Preis ist Sichtbarkeit: hier steht Jawtext. Deshalb steht es auch so in
    der Oberflaeche — dieser Bereich ist ein Aushang, kein Gespraech unter vier
    Augen.
*/
IF OBJECT_ID('dbo.rc_event_topic', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_topic
    (
        id               uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_topic PRIMARY KEY,
        event_id         uniqueidentifier NOT NULL,
        part_id          uniqueidentifier NOT NULL,
        registration_id  uniqueidentifier NULL,

        author_name      nvarchar(120) NOT NULL,
        title            nvarchar(200) NOT NULL,

        /* 'open', 'answered', 'hidden' — verborgen heisst: von der Verwaltung
           aus der Ansicht genommen, nicht geloescht. */
        status           nvarchar(20) NOT NULL
            CONSTRAINT df_rc_event_topic_status DEFAULT N'open',

        created_at       datetimeoffset(7) NOT NULL,
        last_message_at  datetimeoffset(7) NOT NULL,
        message_count    int NOT NULL CONSTRAINT df_rc_event_topic_count DEFAULT 0,

        CONSTRAINT ck_rc_event_topic_status
            CHECK (status IN (N'open', N'answered', N'hidden')),

        CONSTRAINT fk_rc_event_topic_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
        CONSTRAINT fk_rc_event_topic_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id)
    );

    CREATE INDEX ix_rc_event_topic_part ON dbo.rc_event_topic (part_id, last_message_at DESC);
END
GO

IF OBJECT_ID('dbo.rc_event_topic_message', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_event_topic_message
    (
        id              uniqueidentifier NOT NULL
            CONSTRAINT pk_rc_event_topic_message PRIMARY KEY,
        topic_id        uniqueidentifier NOT NULL,
        registration_id uniqueidentifier NULL,

        author_name     nvarchar(120) NOT NULL,
        body            nvarchar(max) NOT NULL,

        /* Aus der Ansicht genommen, nicht geloescht: wer eine Antwort schon
           gelesen hat, soll sie nicht spurlos verlieren. */
        is_hidden       bit NOT NULL CONSTRAINT df_rc_event_topic_msg_hidden DEFAULT 0,

        /* Von der Verwaltung geschrieben — steht in der Ansicht anders da als
           die Frage eines Teilnehmers. */
        is_official     bit NOT NULL CONSTRAINT df_rc_event_topic_msg_official DEFAULT 0,

        created_at      datetimeoffset(7) NOT NULL,

        CONSTRAINT fk_rc_event_topic_message_topic
            FOREIGN KEY (topic_id) REFERENCES dbo.rc_event_topic (id)
    );

    CREATE INDEX ix_rc_event_topic_message_topic
        ON dbo.rc_event_topic_message (topic_id, created_at);
END
GO
