/* ===========================================================================
   rc_0011_confirmation — Firmung: Jahrgang, Kandidaten, Treffen

   ---------------------------------------------------------------------------
   DIES IST DER EMPFINDLICHSTE TEIL DER GANZEN PLATTFORM.

   Firmkandidaten sind Minderjaehrige. Was hier steht — Name, Geburtsdatum,
   Eltern, Schule, Taufpfarrei, dazu Notizen des Katecheten — ist besondere
   Kategorie nach 12.9, und zwar ohne Abwaegung: Religionszugehoerigkeit ist
   es per Definition, und alles andere haengt daran.

   DREI DINGE AUS DEM ALTBESTAND WERDEN DABEI AUSDRUECKLICH NICHT UEBERNOMMEN.

   1. `ParishConfirmationNote.NoteText` lag im KLARTEXT in der Spalte, mit
      einem Schalter `IsPublic` daneben. Eine Notiz ueber ein Kind, unter
      seinem Namen, lesbar fuer jeden mit Datenbankzugriff. Hier liegt sie
      versiegelt — und der Schalter bleibt, weil die Unterscheidung richtig
      ist: was die Eltern sehen duerfen, ist etwas anderes als was der
      Katechet sich notiert.

   2. `HostInviteToken` und `VerificationToken` waren rohe Zeichenketten in
      der Zeile. Wer die Tabelle hatte, hatte die Token. Hier gibt es keinen
      zweiten Token-Baustein: rc_token traegt auch diese (10.3.1), und
      gespeichert wird nur der Abdruck.

   3. `PayloadEnc` war EIN verschluesselter Klumpen fuer alles. Das ist
      bequem und verliert die Feldnamen aus 3.13: wer Schreibzugriff hat,
      kann den Klumpen als Ganzes tauschen, und niemand merkt es. Hier
      traegt jedes Feld sein eigenes Etikett.

   ---------------------------------------------------------------------------
   WAS IM KLARTEXT BLEIBT, UND WARUM.

   Die Ablaufmerker (Einwilligung da, Papier da, Quiz bestanden) sind
   Klartext. Sie sind keine Auskunft ueber die Person, sondern ueber den
   Vorgang — und ohne sie liesse sich nicht einmal zaehlen, wie viele noch
   etwas abgeben muessen, ohne jeden Datensatz zu entschluesseln.

   Die ZEITEN der Treffen sind Klartext, aus demselben Grund wie im Kalender:
   freie Plaetze zaehlen, Ueberschneidungen sehen, Reihen ausrechnen.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Der Jahrgang
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_confirmation_group (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    parish_id   uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder und Zertifikate kommen. Ein EIGENER
       Bereich, nicht der der Pfarrei: wer den Messplan pflegt, hat damit
       nicht auch Zugriff auf die Akten der Kinder. Das ist der ganze Sinn
       davon, dass ein Bereich die Einheit der Sichtbarkeit ist.            */
    area_id     uniqueidentifier     NOT NULL,

    name        nvarchar(120)        NOT NULL,   -- "Firmung 2027"
    starts_on   date                 NULL,
    ends_on     date                 NULL,

    /* preparing | running | closed */
    lifecycle   nvarchar(16)         NOT NULL CONSTRAINT df_rc_conf_life DEFAULT N'preparing',

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_confirmation_group PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_confirmation_group_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_conf_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_conf_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_conf_life CHECK (lifecycle IN (N'preparing', N'running', N'closed')),
    CONSTRAINT ck_rc_conf_span CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
GO

CREATE UNIQUE INDEX uq_rc_conf_area ON dbo.rc_confirmation_group (area_id);
GO

/* ---------------------------------------------------------------------------
   Kandidaten

   Jedes Feld traegt sein eigenes Etikett (3.13). Der Altbestand hatte einen
   Klumpen; damit laesst sich der Klumpen eines Kindes gegen den eines anderen
   tauschen, ohne dass etwas auffaellt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_candidate (
    seq                bigint IDENTITY(1,1) NOT NULL,
    id                 uniqueidentifier     NOT NULL,
    group_id           uniqueidentifier     NOT NULL,

    epoch              int                  NOT NULL,

    /* Alles Personenbezogene liegt versiegelt, jedes Feld fuer sich. */
    name_sealed        varbinary(1024)      NOT NULL,
    born_sealed        varbinary(512)       NULL,
    contact_sealed     varbinary(2048)      NULL,   -- Telefon, E-Mail der Eltern
    school_sealed      varbinary(1024)      NULL,
    baptism_sealed     varbinary(1024)      NULL,   -- Taufpfarrei, Taufdatum

    /* ---- Ablaufmerker: Klartext, weil sie den VORGANG betreffen --------- */
    /*
       Ohne sie liesse sich nicht zaehlen, wer noch etwas abgeben muss, ohne
       jeden Datensatz zu entschluesseln. Sie sagen nichts ueber die Person —
       nur darueber, was noch fehlt.
    */
    consent_given      bit                  NOT NULL CONSTRAINT df_rc_cand_consent DEFAULT 0,
    paper_received     bit                  NOT NULL CONSTRAINT df_rc_cand_paper DEFAULT 0,
    quiz_passed        bit                  NOT NULL CONSTRAINT df_rc_cand_quiz DEFAULT 0,

    /* 12.10 — Unter welchem Einwilligungstext aufgenommen wurde. Ohne diesen
       Verweis liesse sich spaeter nicht sagen, wozu jemand ja gesagt hat.   */
    consent_text_id    uniqueidentifier     NULL,

    /* enrolled | withdrawn | confirmed */
    status             nvarchar(16)         NOT NULL CONSTRAINT df_rc_cand_status DEFAULT N'enrolled',

    /* 12.3 — Austritt vernichtet die Felder, laesst die Zeile stehen. Sonst
       stimmten die Zahlen des Jahrgangs nicht mehr.                        */
    withdrawn_at       datetimeoffset(7)    NULL,

    created_at         datetimeoffset(7)    NOT NULL,
    updated_at         datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_candidate PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_candidate_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_candidate_group FOREIGN KEY (group_id) REFERENCES dbo.rc_confirmation_group (id),
    CONSTRAINT ck_rc_cand_status CHECK (status IN (N'enrolled', N'withdrawn', N'confirmed')),

    /* Ein ausgetretener Kandidat hat kein Datum? Dann ist er nicht
       ausgetreten. Der Merker und das Datum gehoeren zusammen.             */
    CONSTRAINT ck_rc_cand_withdrawn CHECK (
        (status = N'withdrawn' AND withdrawn_at IS NOT NULL)
     OR (status <> N'withdrawn' AND withdrawn_at IS NULL))
);
GO

CREATE INDEX ix_rc_candidate_group ON dbo.rc_candidate (group_id, status);
GO

/* ---------------------------------------------------------------------------
   Notizen

   Der Altbestand hatte sie im Klartext. Hier nicht — und die Unterscheidung
   oeffentlich/intern bleibt, weil sie richtig ist: was die Eltern sehen
   duerfen, ist etwas anderes als was der Katechet sich notiert.

   Beide liegen versiegelt. „Oeffentlich" heisst hier nicht „unverschluesselt",
   sondern „auch fuer die Familie sichtbar" — anders als beim Messplan, wo
   oeffentlich wirklich am Schaukasten haengt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_candidate_note (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    candidate_id   uniqueidentifier     NOT NULL,
    author_role_id uniqueidentifier     NOT NULL,

    epoch          int                  NOT NULL,
    text_sealed    varbinary(max)       NOT NULL,

    /* Sichtbar auch fuer die Familie? */
    for_family     bit                  NOT NULL CONSTRAINT df_rc_note_family DEFAULT 0,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_candidate_note PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_candidate_note_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_note_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.rc_candidate (id)
);
GO

CREATE INDEX ix_rc_note_candidate ON dbo.rc_candidate_note (candidate_id, created_at);
GO

/* ---------------------------------------------------------------------------
   Treffen

   Die ZEIT ist Klartext, wie im Kalender: freie Plaetze zaehlen und
   Ueberschneidungen sehen geht sonst nicht ohne Schluessel. Was BESPROCHEN
   wird, ist etwas anderes und liegt versiegelt.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_meeting_slot (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    group_id     uniqueidentifier     NOT NULL,

    starts_at    datetimeoffset(7)    NOT NULL,
    duration_min int                  NOT NULL CONSTRAINT df_rc_slot_dur DEFAULT 60,

    /* Wie viele Plaetze. Klartext — es ist eine Zahl ueber den Vorgang. */
    capacity     int                  NOT NULL CONSTRAINT df_rc_slot_cap DEFAULT 1,

    /* Was dransteht, wenn sich jemand eintraegt: "Gespraech", "Gruppe A".
       Klartext, weil es auf dem Aushang steht.                             */
    label        nvarchar(120)        NULL,

    /* In welchem Abschnitt der Vorbereitung. */
    stage        nvarchar(32)         NOT NULL CONSTRAINT df_rc_slot_stage DEFAULT N'year1',

    is_open      bit                  NOT NULL CONSTRAINT df_rc_slot_open DEFAULT 1,

    created_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_meeting_slot PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_meeting_slot_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_slot_group FOREIGN KEY (group_id) REFERENCES dbo.rc_confirmation_group (id),
    CONSTRAINT ck_rc_slot_cap CHECK (capacity BETWEEN 1 AND 500),
    CONSTRAINT ck_rc_slot_dur CHECK (duration_min BETWEEN 5 AND 600)
);
GO

CREATE INDEX ix_rc_slot_when ON dbo.rc_meeting_slot (group_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Anmeldungen zu einem Treffen

   Die Kapazitaet wird von der DATENBANK durchgesetzt, nicht vom Code: zwei
   gleichzeitige Anmeldungen auf den letzten Platz sind der Normalfall, und
   eine Pruefung im Code davor ist genau dann falsch, wenn es darauf ankommt.
   Der eindeutige Index verhindert die Doppelbuchung derselben Person; die
   Zaehlung laeuft in einer serialisierbaren Transaktion.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_meeting_booking (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    slot_id      uniqueidentifier     NOT NULL,
    candidate_id uniqueidentifier     NOT NULL,

    booked_at    datetimeoffset(7)    NOT NULL,
    attended     bit                  NULL,       -- NULL = noch nicht gewesen

    CONSTRAINT pk_rc_meeting_booking PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_meeting_booking_id UNIQUE NONCLUSTERED (id),

    /* Ein Kandidat, ein Platz je Treffen. */
    CONSTRAINT uq_rc_booking_pair UNIQUE NONCLUSTERED (slot_id, candidate_id),

    CONSTRAINT fk_rc_booking_slot FOREIGN KEY (slot_id) REFERENCES dbo.rc_meeting_slot (id),
    CONSTRAINT fk_rc_booking_candidate FOREIGN KEY (candidate_id) REFERENCES dbo.rc_candidate (id)
);
GO

CREATE INDEX ix_rc_booking_slot ON dbo.rc_meeting_booking (slot_id);
GO

/* ---------------------------------------------------------------------------
   Anfuegend

   Notizen ueber ein Kind werden nicht still geloescht. Wer eine zurueckziehen
   will, schreibt eine neue — dieselbe Regel wie bei Nachrichten, und aus
   demselben Grund: eine Akte, aus der sich lautlos etwas entfernen laesst,
   ist keine Akte.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_candidate_note_append
ON dbo.rc_candidate_note
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_candidate_note ist anfuegend: eine Notiz wird ergaenzt, nicht geaendert.', 1;
END;
GO
