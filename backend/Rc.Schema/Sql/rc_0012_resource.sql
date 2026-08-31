/* ===========================================================================
   rc_0012_resource — Belegung: Haus, Zimmer, Pfarrsaal

   ---------------------------------------------------------------------------
   WARUM DAS KEIN KALENDER IST.

   Ein Kalendereintrag beantwortet „wann ist dieser MENSCH belegt". Die
   Belegung beantwortet „ist diese SACHE frei". Der Eigentuemer ist ein anderer
   (eine Rolle gegen ein Zimmer), die Frage ist eine andere, und vor allem ist
   die oeffentliche Projektion eine andere: beim Kalender ist die Vorgabe
   privat, hier ist sie oeffentlich. Ein Haus, dessen freie Zeitraeume niemand
   sehen darf, laesst sich nicht vermieten.

   Geteilt wird die Rechnerei — Ueberschneidungen, Zeitzonen, Wiederholungen —,
   nicht das Modell. `RcRecurrence` bleibt der eine Ort, an dem eine Reihe
   ausgerechnet wird.

   ---------------------------------------------------------------------------
   DIE REGEL DES MODULS.

   Die ZEIT liegt im Klartext, alles andere nicht. Dieselbe Entscheidung wie im
   Kalender (`title_public` offen, `title_sealed` versiegelt), hier auf Raeume
   angewandt: wer fragt, erfaehrt, ob der Juli frei ist — nicht, wer im Juli
   kommt. Deshalb gibt es in `rc_resource_hold` KEINE Spalte fuer die Gruppe.
   Nicht leer gelassen, sondern nicht vorhanden: eine Spalte, die es gibt,
   wird irgendwann gefuellt, und dann steht der Name der Firmgruppe im
   oeffentlichen Belegungsplan.

   ---------------------------------------------------------------------------
   DREI ZUSTAENDE, UND DER MITTLERE IST DER WICHTIGE.

       frei  ->  vorgemerkt (laeuft ab)  ->  bestaetigt

   Ohne den vorgemerkten Zustand MIT Ablauf bekommen zwei Gruppen dieselbe
   Juliwoche als frei gemeldet. Der Ablauf steht in der Zeile und wird in der
   Abfrage durchgesetzt, nicht von einem Aufraeumlauf: ein Vormerk, der nur
   deshalb noch gilt, weil ein Dienst gerade nicht laeuft, ist kein Vormerk.

   „Frei" ist die ABWESENHEIT einer Zeile. Freie Tage zu speichern hiesse, fuer
   jedes Haus bis in alle Zukunft Zeilen anzulegen.
   =========================================================================== */

CREATE TABLE dbo.rc_resource
(
    id                    uniqueidentifier NOT NULL CONSTRAINT pk_rc_resource PRIMARY KEY,

    /* Wie jedes Modul haengt auch dieses an einem Bereich. Kein eigener
       Schluesselhaushalt, keine eigenen Epochen, keine eigene Kette. */
    area_id               uniqueidentifier NOT NULL,

    /* Der Teil der Adresse nach dem Modulnamen: /osrodek, spaeter
       /parafia/<slug>/sala. Klein geschrieben und ohne Leerzeichen. */
    slug                  nvarchar(64)     NOT NULL,
    title                 nvarchar(200)    NOT NULL,

    /* Die Zeitzone des HAUSES, nicht des Lesers. Ein Zeitraum wird nach
       Naechten belegt; welcher Tag gemeint ist, entscheidet der Ort. */
    time_zone             nvarchar(64)     NOT NULL CONSTRAINT df_rc_resource_tz DEFAULT N'Europe/Warsaw',

    capacity              int              NULL,

    /* Ob die Frei-belegt-Auskunft ohne Konto lesbar ist. Fuer das Haus ja;
       fuer einen Pfarrsaal kann die Antwort anders ausfallen. */
    is_public             bit              NOT NULL CONSTRAINT df_rc_resource_public DEFAULT 1,

    /* Der Annahmeschluessel — derselbe Bau wie bei den Veranstaltungen
       (rc_0007). Eine Gruppe, die anfragt, haelt keinen Epochenschluessel;
       sie verschluesselt gegen den oeffentlichen Teil, und nur wer den
       privaten haelt, liest die Anfrage. */
    intake_public_key     varbinary(1024)  NULL,
    intake_private_sealed varbinary(max)   NULL,
    intake_epoch          int              NULL,

    created_at            datetimeoffset(7) NOT NULL,

    CONSTRAINT uq_rc_resource_slug UNIQUE (slug),
    CONSTRAINT fk_rc_resource_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),

    CONSTRAINT ck_rc_resource_slug CHECK (
        LEN(slug) BETWEEN 2 AND 64 AND slug NOT LIKE '%[^a-z0-9-]%'),

    CONSTRAINT ck_rc_resource_capacity CHECK (capacity IS NULL OR capacity > 0),

    /* Entweder ganz oder gar nicht — ein oeffentlicher Schluessel ohne den
       privaten nimmt Anfragen entgegen, die niemand mehr oeffnet. */
    CONSTRAINT ck_rc_resource_intake CHECK (
        (intake_public_key IS NULL AND intake_private_sealed IS NULL AND intake_epoch IS NULL)
     OR (intake_public_key IS NOT NULL AND intake_private_sealed IS NOT NULL AND intake_epoch IS NOT NULL))
);
GO

CREATE INDEX ix_rc_resource_area ON dbo.rc_resource (area_id);
GO

/* ---------------------------------------------------------------------------
   Belegte Zeitraeume
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_resource_hold
(
    id          uniqueidentifier NOT NULL CONSTRAINT pk_rc_resource_hold PRIMARY KEY,
    resource_id uniqueidentifier NOT NULL,

    /* Tage, keine Zeitpunkte. Ein Haus wird nach Naechten belegt, und eine
       Uhrzeit waere eine Genauigkeit, die es nicht gibt. Beide Raender
       gehoeren dazu: „vom 10. bis 14." schliesst den 14. ein. */
    from_date   date             NOT NULL,
    to_date     date             NOT NULL,

    state       nvarchar(16)     NOT NULL,

    /* Nur fuer Vormerkungen. Ein bestaetigter Zeitraum laeuft nicht ab. */
    expires_at  datetimeoffset(7) NULL,

    /* Woher der Zeitraum kommt — eine Anfrage oder die Hand des Hausherrn.
       Bewusst NUR eine Kennung und kein Name: die Zeile wird oeffentlich
       projiziert, und was hier steht, kann irgendwann mitgezeigt werden. */
    enquiry_id  uniqueidentifier NULL,

    created_at  datetimeoffset(7) NOT NULL,
    updated_at  datetimeoffset(7) NOT NULL,

    CONSTRAINT fk_rc_hold_resource FOREIGN KEY (resource_id) REFERENCES dbo.rc_resource (id),

    CONSTRAINT ck_rc_hold_state CHECK (state IN (N'held', N'confirmed')),

    /* Rueckwaerts laufende Zeitraeume gibt es nicht. */
    CONSTRAINT ck_rc_hold_order CHECK (from_date <= to_date),

    /* Der Kern des Zustandsmodells, in einer Bedingung: eine Vormerkung OHNE
       Ablauf waere eine stille Dauerbelegung, und ein bestaetigter Zeitraum
       MIT Ablauf verschwaende ohne Vorwarnung. */
    CONSTRAINT ck_rc_hold_expiry CHECK (
        (state = N'held'      AND expires_at IS NOT NULL)
     OR (state = N'confirmed' AND expires_at IS NULL))
);
GO

CREATE INDEX ix_rc_hold_resource_span ON dbo.rc_resource_hold (resource_id, from_date, to_date);
GO

/* ---------------------------------------------------------------------------
   Anfragen

   Offen eingesandt, versiegelt abgelegt. Die Zeitangaben bleiben Klartext —
   ohne sie liesse sich eine Anfrage keinem Zeitraum zuordnen, und der
   Hausherr muesste jede einzelne oeffnen, um zu wissen, ob sie ihn angeht.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_enquiry
(
    id                    uniqueidentifier NOT NULL CONSTRAINT pk_rc_enquiry PRIMARY KEY,
    resource_id           uniqueidentifier NOT NULL,

    from_date             date             NOT NULL,
    to_date               date             NOT NULL,
    people                int              NULL,

    /* Der Sitzungsschluessel, verpackt gegen den Annahmeschluessel. */
    session_key_wrapped   varbinary(max)   NOT NULL,

    /* Je Feld ein eigener Geheimtext mit eigenem Etikett (3.13). Ein einziger
       Klumpen liesse sich als Ganzes gegen den einer anderen Anfrage
       tauschen, ohne dass etwas auffaellt. */
    group_name_sealed     varbinary(max)   NOT NULL,
    contact_person_sealed varbinary(max)   NULL,
    contact_sealed        varbinary(max)   NOT NULL,
    group_kind_sealed     varbinary(max)   NULL,
    note_sealed           varbinary(max)   NULL,

    state                 nvarchar(16)     NOT NULL CONSTRAINT df_rc_enquiry_state DEFAULT N'new',
    received_at           datetimeoffset(7) NOT NULL,

    CONSTRAINT fk_rc_enquiry_resource FOREIGN KEY (resource_id) REFERENCES dbo.rc_resource (id),
    CONSTRAINT ck_rc_enquiry_state CHECK (state IN (N'new', N'answered', N'declined')),
    CONSTRAINT ck_rc_enquiry_order CHECK (from_date <= to_date),
    CONSTRAINT ck_rc_enquiry_people CHECK (people IS NULL OR people > 0)
);
GO

CREATE INDEX ix_rc_enquiry_resource ON dbo.rc_enquiry (resource_id, received_at DESC);
GO

ALTER TABLE dbo.rc_resource_hold
    ADD CONSTRAINT fk_rc_hold_enquiry FOREIGN KEY (enquiry_id) REFERENCES dbo.rc_enquiry (id);
GO

/* ---------------------------------------------------------------------------
   Anfuegend

   Der INHALT einer Anfrage wird nicht geaendert. Wer sie beantwortet, aendert
   ihren Zustand — was jemand geschrieben hat, bleibt stehen. Eine Anfrage, aus
   der sich nachtraeglich ein Satz entfernen laesst, ist kein Beleg mehr.

   Der Zustand ist ausdruecklich ausgenommen: er ist Bearbeitung, kein Inhalt.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_enquiry_append
ON dbo.rc_enquiry
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM deleted)
        AND NOT EXISTS (SELECT 1 FROM inserted)
        THROW 50012, N'rc_enquiry ist anfuegend: eine Anfrage wird nicht geloescht.', 1;

    /* Nur der Zustand darf sich bewegen. Jede andere Spalte, die sich
       unterscheidet, bricht ab.

       INTERSECT und nicht eine Kette von `<>`: es vergleicht alle Spalten auf
       einmal, BYTEGENAU und mit NULL als vergleichbarem Wert. Der erste Anlauf
       verglich `DATALENGTH` der Geheimtexte — und liess damit genau das durch,
       was er verhindern sollte: ein Byte gegen ein anderes derselben Laenge zu
       tauschen. Die Probe hat es gefunden, das Auge nicht. */
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN deleted d ON d.id = i.id
        WHERE NOT EXISTS (
            SELECT i.resource_id, i.from_date, i.to_date, i.people, i.received_at,
                   i.session_key_wrapped, i.group_name_sealed, i.contact_person_sealed,
                   i.contact_sealed, i.group_kind_sealed, i.note_sealed
            INTERSECT
            SELECT d.resource_id, d.from_date, d.to_date, d.people, d.received_at,
                   d.session_key_wrapped, d.group_name_sealed, d.contact_person_sealed,
                   d.contact_sealed, d.group_kind_sealed, d.note_sealed))
        THROW 50012, N'rc_enquiry ist anfuegend: nur der Zustand darf sich aendern.', 1;

    UPDATE e
       SET state = i.state
      FROM dbo.rc_enquiry e
      JOIN inserted i ON i.id = e.id;
END;
GO
