/* ===========================================================================
   rc_0006_events — Veranstaltungen: Seiten, Teile, Felder, Anmeldungen

   Das Teilesystem ist die beste Abstraktion des Altbestands (siehe
   _reference/README.md) und wird uebernommen. Eine Veranstaltung ist eine
   Folge von Seiten, eine Seite eine Folge von Teilen, und jeder Teil traegt
   eine Nutzlast, die nur sein eigenes Modul versteht.

   ---------------------------------------------------------------------------
   ZWEI ENTSCHEIDUNGEN TRAGEN DIESES SCHEMA. Beide sind Abweichungen vom
   Altbestand, und beide folgen aus dem, was hier ohnehin schon steht.

   ERSTENS: EINE VERANSTALTUNG HAENGT AN EINEM BEREICH.

   Sie bekommt KEINE eigenen Epochen, keine eigene Schluesselverwaltung, keine
   eigene Kette und keine eigenen Zertifikate. Sie zeigt auf einen Bereich, und
   der bringt das alles mit.

   Der erste Entwurf hatte all das doppelt: rc_event_epoch, rc_event_key, eine
   eigene ledger_id. Das waere eine ZWEITE Umsetzung des heikelsten Codes der
   Plattform gewesen — und die zweite ist immer die, die beim naechsten Befund
   vergessen wird.

   Es passt auch sachlich: wer eine Veranstaltung vorbereitet, ist eine Gruppe,
   die miteinander redet, Beschluesse fasst und Leute dazuholt. Genau das ist
   ein Bereich. Eine Veranstaltung ist ein Bereich mit Seiten daran.

   ZWEITENS: OEFFENTLICHER INHALT WIRD NICHT VERSCHLUESSELT.

   Der naheliegende Weg waere, alles zu versiegeln und fuer oeffentliche Seiten
   den Schluessel mitzuliefern. Das waere Theater: ein Schluessel, den jeder
   bekommt, ist kein Schluessel. Es saehe nach Schutz aus, wo keiner ist, und
   das ist schlimmer als sichtbar ungeschuetzt.

   Ein Teil ist deshalb ENTWEDER oeffentlich (Klartext, von jedem lesbar) ODER
   intern (versiegelt unter dem Epochenschluessel des Bereichs). Die Datenbank
   erzwingt, dass genau eines von beidem gilt — sonst entstuende irgendwann
   eine Zeile mit beidem, und niemand wuesste mehr, welche Fassung gilt.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Veranstaltung
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder, Zertifikate und Kette kommen. */
    area_id        uniqueidentifier     NOT NULL,
    tenant_id      uniqueidentifier     NOT NULL,

    /* Die Adresse. Klartext, weil sie in der Adresszeile steht — sie zu
       versiegeln waere Theater: wer den Link hat, hat sie ohnehin.          */
    slug           nvarchar(80)         NOT NULL,

    /* Der Titel steht in der Adresszeile, im Reiter und in jedem geteilten
       Vorschaubild. Er ist bei einer oeffentlichen Veranstaltung ohnehin
       oeffentlich; bei einer internen liegt der Bereichstitel versiegelt
       daneben und traegt, was nicht heraus soll.                            */
    title          nvarchar(200)        NOT NULL,

    /* draft | published | archived. Ein Entwurf ist NICHT oeffentlich, auch
       wenn is_public steht: sonst waere jede halbfertige Seite im Netz.     */
    lifecycle      nvarchar(16)         NOT NULL CONSTRAINT df_rc_event_life DEFAULT N'draft',

    /* Oeffentlich heisst: ohne Konto lesbar. Es heisst NICHT, dass alles
       daran oeffentlich ist — jeder Teil entscheidet das fuer sich.         */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_event_public DEFAULT 0,

    starts_at      datetimeoffset(7)    NULL,
    ends_at        datetimeoffset(7)    NULL,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_event_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_event_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_event_life CHECK (lifecycle IN (N'draft', N'published', N'archived')),

    /* Ein Zeitraum, der rueckwaerts laeuft, ist keine Eingabe, sondern ein
       Fehler — und er faellt sonst erst bei der Anzeige auf.                */
    CONSTRAINT ck_rc_event_span CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
GO

CREATE INDEX ix_rc_event_tenant ON dbo.rc_event (tenant_id, lifecycle);
GO

/* Ein Bereich traegt hoechstens eine Veranstaltung. Zwei waeren zwei
   Oeffentlichkeiten hinter demselben Schluessel — und beim Entfernen eines
   Mitglieds wuesste niemand mehr, welche der beiden gemeint war. */
CREATE UNIQUE INDEX uq_rc_event_area ON dbo.rc_event (area_id);
GO

/* ---------------------------------------------------------------------------
   Seiten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_page (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,
    event_id    uniqueidentifier     NOT NULL,
    sort_order  int                  NOT NULL,
    slug        nvarchar(80)         NOT NULL,
    title       nvarchar(200)        NOT NULL,
    is_visible  bit                  NOT NULL CONSTRAINT df_rc_event_page_vis DEFAULT 1,
    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event_page PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_page_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_event_page_slug UNIQUE NONCLUSTERED (event_id, slug),
    CONSTRAINT fk_rc_event_page_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id)
);
GO

/* ---------------------------------------------------------------------------
   Teile — das uebernommene Teilesystem
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_part (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    page_id        uniqueidentifier     NOT NULL,
    sort_order     int                  NOT NULL,

    /* Die ART bleibt immer Klartext, auch bei internen Teilen. Sie ist
       Struktur, kein Inhalt: ohne sie liesse sich nicht einmal entscheiden,
       WELCHES Modul den Schluessel ueberhaupt braeuchte. Sie verraet, DASS
       es eine Karte gibt — nicht, wo sie hinzeigt.                          */
    kind           nvarchar(20)         NOT NULL,

    /* Oeffentlich oder intern. Davon haengt ab, in welcher der beiden
       Spaltenfamilien der Inhalt steht.                                     */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_event_part_pub DEFAULT 1,

    /* Bei internen Teilen: unter welcher Epoche des Bereichs versiegelt.
       NULL bei oeffentlichen — dort gibt es nichts zu entschluesseln.       */
    epoch          int                  NULL,

    menu_label     nvarchar(60)         NULL,

    /* Oeffentlich: Klartext. */
    title          nvarchar(200)        NULL,
    intro          nvarchar(600)        NULL,
    config_json    nvarchar(max)        NULL,
    layers_json    nvarchar(max)        NULL,

    /* Intern: versiegelt unter dem Epochenschluessel des Bereichs. */
    title_sealed   varbinary(1024)      NULL,
    intro_sealed   varbinary(2048)      NULL,
    config_sealed  varbinary(max)       NULL,
    layers_sealed  varbinary(max)       NULL,

    is_visible     bit                  NOT NULL CONSTRAINT df_rc_event_part_vis DEFAULT 1,
    created_at     datetimeoffset(7)    NOT NULL,
    updated_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_event_part PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_part_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_part_page FOREIGN KEY (page_id) REFERENCES dbo.rc_event_page (id),

    /* Die Aufzaehlung steht in der Datenbank und nicht nur im Klienten. Ein
       unbekannter Teil waere eine Seite, die niemand mehr darstellen kann —
       und er faellt sonst erst beim Lesen auf, lange nach dem Schreiben.    */
    CONSTRAINT ck_rc_event_part_kind CHECK (kind IN (
        N'title', N'shortinfos', N'text', N'plan', N'map', N'faq',
        N'form', N'costs', N'contact', N'gallery', N'files', N'people')),

    /* ENTWEDER oeffentlich ODER versiegelt — nie beides und nie keines. Ohne
       diese Bedingung entstuende irgendwann eine Zeile mit beidem, und
       niemand wuesste mehr, welche Fassung gilt.                            */
    CONSTRAINT ck_rc_event_part_form CHECK (
        (is_public = 1 AND epoch IS NULL
            AND title_sealed IS NULL AND intro_sealed IS NULL
            AND config_sealed IS NULL AND layers_sealed IS NULL)
     OR (is_public = 0 AND epoch IS NOT NULL
            AND title IS NULL AND intro IS NULL
            AND config_json IS NULL AND layers_json IS NULL))
);
GO

CREATE INDEX ix_rc_event_part_page ON dbo.rc_event_part (page_id, sort_order);
GO

/* ---------------------------------------------------------------------------
   Formularfelder

   Sie liegen relational und NICHT im ConfigJson — dieselbe Entscheidung wie
   im Altbestand, und sie war richtig: nur so lassen sich Antworten pruefen,
   auflisten und einer Person zuordnen.

   Die Beschriftung ist Klartext. Sie steht auf dem Formular, das jeder sieht,
   der es ausfuellen soll; sie zu versiegeln waere derselbe Selbstbetrug wie
   bei oeffentlichen Teilen. Die ANTWORTEN sind etwas anderes.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_field (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    part_id         uniqueidentifier     NOT NULL,
    sort_order      int                  NOT NULL,

    kind            nvarchar(16)         NOT NULL,
    label           nvarchar(300)        NOT NULL,
    help_text       nvarchar(400)        NULL,
    options_json    nvarchar(max)        NULL,

    is_required     bit                  NOT NULL CONSTRAINT df_rc_event_field_req DEFAULT 0,
    is_half_width   bit                  NOT NULL CONSTRAINT df_rc_event_field_half DEFAULT 0,

    /* none | name | contact. Ein Feld als `name` zu kennzeichnen ist das,
       was aus einer anonymen Einsendung eine Person macht, der man Zugang
       geben kann. Deshalb steht es hier und nicht in einer Beschreibung.    */
    identity_role   nvarchar(12)         NOT NULL CONSTRAINT df_rc_event_field_ident DEFAULT N'none',

    /* 12.9 — Die Klasse gehoert an das FELD, nicht an eine Beschreibung.
       normal | sensitive | special | secret. Vorgabe ist `special`: bei
       Anmeldungen ist Ernaehrung, Unvertraeglichkeit oder Konfession der
       Normalfall, nicht die Ausnahme. Wer weniger will, sagt es ausdruecklich
       — und trifft damit eine Entscheidung, statt in sie hineinzurutschen.  */
    data_class      nvarchar(12)         NOT NULL CONSTRAINT df_rc_event_field_class DEFAULT N'special',

    CONSTRAINT pk_rc_event_field PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_field_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_field_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id),
    CONSTRAINT ck_rc_event_field_kind CHECK (kind IN (
        N'text', N'textarea', N'select', N'multiselect', N'checkbox',
        N'number', N'date', N'email', N'phone')),
    CONSTRAINT ck_rc_event_field_ident CHECK (identity_role IN (N'none', N'name', N'contact')),
    CONSTRAINT ck_rc_event_field_class CHECK (data_class IN
        (N'normal', N'sensitive', N'special', N'secret')),

    /* Eine Auswahl ohne Auswahlmoeglichkeiten ist ein Feld, das niemand
       ausfuellen kann. Das faellt sonst erst dem ersten Anmelder auf.       */
    CONSTRAINT ck_rc_event_field_options CHECK (
        kind NOT IN (N'select', N'multiselect') OR options_json IS NOT NULL)
);
GO

CREATE INDEX ix_rc_event_field_part ON dbo.rc_event_field (part_id, sort_order);
GO

/* ---------------------------------------------------------------------------
   Anmeldungen

   Hier hoert das Oeffentliche auf. Ein Formular kann jeder sehen; was jemand
   hineingeschrieben hat, ist IMMER versiegelt — auch bei einer voellig
   oeffentlichen Veranstaltung.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_event_registration (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    event_id        uniqueidentifier     NOT NULL,
    part_id         uniqueidentifier     NOT NULL,

    /* Unter welcher Epoche des Bereichs die Werte liegen. */
    epoch           int                  NOT NULL,

    /* NULL heisst: ohne Konto eingesandt. Das ist der Normalfall bei einer
       oeffentlichen Veranstaltung und kein Mangel.                          */
    submitter_role_id uniqueidentifier   NULL,

    /* Nachweis fuer den, der ohne Konto eingesandt hat: nur SHA-256 liegt
       hier. Wer die Tabelle hat, kann die Anmeldung nicht aufrufen — nur
       wer den Beleg hat, den er beim Absenden bekommen hat.                 */
    claim_hash      binary(32)           NULL,

    submitted_at    datetimeoffset(7)    NOT NULL,

    /* 12.10 — Unter welchem Einwilligungstext eingesandt wurde. Ohne diesen
       Verweis liesse sich spaeter nicht sagen, wozu jemand ja gesagt hat —
       und ein geaenderter Text wuerde rueckwirkend fuer alle gelten.        */
    consent_text_id uniqueidentifier     NULL,

    /* 12.3 — Ruecknahme ist keine Loeschung der Zeile, sondern die
       Vernichtung der Werte. Die Zeile bleibt, damit die Zahlen stimmen;
       was drinstand, ist weg.                                               */
    withdrawn_at    datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_event_registration PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_registration_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_event_reg_event FOREIGN KEY (event_id) REFERENCES dbo.rc_event (id),
    CONSTRAINT fk_rc_event_reg_part FOREIGN KEY (part_id) REFERENCES dbo.rc_event_part (id),

    /* Entweder ein Konto oder ein Beleg — eine Anmeldung, die keinem von
       beiden gehoert, koennte niemand mehr zurueckziehen.                   */
    CONSTRAINT ck_rc_event_reg_owner CHECK (
        submitter_role_id IS NOT NULL OR claim_hash IS NOT NULL)
);
GO

CREATE INDEX ix_rc_event_reg_part ON dbo.rc_event_registration (part_id, submitted_at);
GO

CREATE TABLE dbo.rc_event_registration_value (
    seq              bigint IDENTITY(1,1) NOT NULL,
    registration_id  uniqueidentifier     NOT NULL,
    field_id         uniqueidentifier     NOT NULL,

    /* NULL nach der Ruecknahme: der Wert ist vernichtet, die Zeile bleibt
       als Grabstein stehen (12.3).                                          */
    value_sealed     varbinary(max)       NULL,

    CONSTRAINT pk_rc_event_reg_value PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_event_reg_value UNIQUE NONCLUSTERED (registration_id, field_id),
    CONSTRAINT fk_rc_event_reg_value_reg FOREIGN KEY (registration_id)
        REFERENCES dbo.rc_event_registration (id),
    CONSTRAINT fk_rc_event_reg_value_field FOREIGN KEY (field_id)
        REFERENCES dbo.rc_event_field (id)
);
GO

/* ---------------------------------------------------------------------------
   Anfuegend, nicht ueberschreibend

   Teile, Seiten und Felder sind ausgenommen: sie WERDEN bearbeitet, das ist
   ihr Zweck. Anmeldungen nicht — was jemand eingesandt hat, verschwindet
   nicht spurlos, sondern wird zurueckgenommen.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_event_registration_append
ON dbo.rc_event_registration
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_event_registration ist anfuegend: Ruecknahme vernichtet die Werte, sie loescht keine Zeilen.', 1;
END;
GO

CREATE TRIGGER dbo.tr_rc_event_reg_value_append
ON dbo.rc_event_registration_value
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_event_registration_value ist anfuegend: der Wert wird auf NULL gesetzt, die Zeile bleibt.', 1;
END;
GO
