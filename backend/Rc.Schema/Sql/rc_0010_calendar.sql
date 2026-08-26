/* ===========================================================================
   rc_0010_calendar — Kalender: Termine, Aufgaben, Wiederholungen

   ---------------------------------------------------------------------------
   DIE ENTSCHEIDUNG, DIE DIESEN KALENDER TRAEGT: ZEIT IST NICHT INHALT.

   Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte, bei einer
   Messintention Felder derselben Zeile. Hier trennt sie etwas Drittes, und es
   ist das Wichtigste am ganzen Modul:

     WANN jemand belegt ist, liegt im Klartext.
     WOMIT er belegt ist, liegt versiegelt.

   Der Altbestand hatte das bereits (TitlePublic neben einem geschuetzten
   Datenelement) und es war richtig. Ein Kalender, der die Zeiten mitverschluesselt,
   kann drei Dinge nicht mehr:

     * freie Zeiten finden, ohne alles herunterzuladen und zu entschluesseln,
     * Ueberschneidungen melden, bevor jemand doppelt zusagt,
     * eine Wiederholung ausrechnen, ohne den Schluessel zu haben.

   Das ist kein Verlust an Schutz, sondern eine ehrliche Grenze: dass jemand
   Dienstag um zehn belegt ist, verraet ungleich weniger als wobei. Wer auch
   das verbergen will, legt den Termin in einen Kalender, den nur er sieht —
   dann sieht niemand die Zeit, weil niemand den Kalender sieht.

   ---------------------------------------------------------------------------
   DER OEFFENTLICHE TITEL IST EIN EIGENES FELD, KEINE KOPIE.

   `title_public` ist NICHT der entschluesselte Titel. Es ist das, was andere
   sehen duerfen — oft nichts (dann steht dort NULL und die Oberflaeche sagt
   „belegt"), manchmal „Sitzung", nie „Gespraech mit Frau K. wegen der
   Kuendigung". Beides in einem Feld zu fuehren hiesse, dass jede Anzeige
   entscheiden muss, wie viel sie verraet — und irgendeine entscheidet falsch.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Der Kalender
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    title       nvarchar(200)        NOT NULL,

    /* Die Zeitzone, in der dieser Kalender gedacht ist. Wiederholungen werden
       DARIN gerechnet, nicht in UTC: „jeden Montag um 9" bleibt sonst ueber
       die Sommerzeit hinweg nicht um 9. Der Fehler faellt genau zweimal im
       Jahr auf und wird jedes Mal fuer einen Zufall gehalten.                */
    time_zone   nvarchar(64)         NOT NULL CONSTRAINT df_rc_calendar_tz DEFAULT N'Europe/Warsaw',

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_calendar_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

CREATE INDEX ix_rc_calendar_area ON dbo.rc_calendar (area_id);
GO

/* ---------------------------------------------------------------------------
   Termine und Aufgaben

   Ein Kalender haelt beides. Der Unterschied ist nicht kosmetisch: ein Termin
   hat einen Anfang und ein Ende, eine Aufgabe hat eine Frist und einen
   Zustand. Sie in zwei Tabellen zu legen hiesse, jede Ansicht zweimal zu
   bauen — und die haeufigste Frage („was steht heute an") betrifft beide.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar_item (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    calendar_id     uniqueidentifier     NOT NULL,
    owner_role_id   uniqueidentifier     NOT NULL,

    /* appointment | task */
    item_type       nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_type DEFAULT N'appointment',

    /* ---- Klartext: WANN ------------------------------------------------- */

    starts_at       datetimeoffset(7)    NOT NULL,
    ends_at         datetimeoffset(7)    NOT NULL,
    all_day         bit                  NOT NULL CONSTRAINT df_rc_item_allday DEFAULT 0,

    /* Was andere sehen duerfen. NULL heisst: nur „belegt". */
    title_public    nvarchar(200)        NULL,

    /* private | area | public
       private — nur der Eigentuemer sieht den Eintrag ueberhaupt.
       area    — die Mitglieder des Bereichs sehen ihn.
       public  — auch ohne Konto sichtbar (dann NUR title_public).           */
    visibility      nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_vis DEFAULT N'private',

    /* planned | confirmed | cancelled | completed */
    status          nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_status DEFAULT N'planned',

    /* ---- Versiegelt: WOMIT ---------------------------------------------- */

    epoch           int                  NULL,
    title_sealed    varbinary(1024)      NULL,
    location_sealed varbinary(1024)      NULL,
    notes_sealed    varbinary(max)       NULL,

    /* ---- Wiederholung ---------------------------------------------------- */
    /* none | daily | weekly | monthly | yearly */

    repeat_kind     nvarchar(16)         NOT NULL CONSTRAINT df_rc_item_repeat DEFAULT N'none',
    repeat_every    int                  NOT NULL CONSTRAINT df_rc_item_every DEFAULT 1,

    /* Bei `weekly`: welche Wochentage, als Bitmaske Mo=1 .. So=64. Eine
       Zeichenkette waere bequemer zu lesen und schwerer zu pruefen.          */
    repeat_weekdays tinyint              NULL,

    /* Ein Ende ist PFLICHT bei einer Wiederholung — entweder ein Datum oder
       eine Anzahl. Eine Reihe ohne Ende laesst sich nicht ausrechnen, nur
       abschneiden, und jede Ansicht schneidet woanders ab.                   */
    repeat_until    datetimeoffset(7)    NULL,
    repeat_count    int                  NULL,

    /* ---- Aufgaben --------------------------------------------------------- */

    task_state      nvarchar(16)         NULL,   -- todo | doing | done | cancelled
    completed_at    datetimeoffset(7)    NULL,

    created_at      datetimeoffset(7)    NOT NULL,
    updated_at      datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar_item PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_item_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_item_calendar FOREIGN KEY (calendar_id) REFERENCES dbo.rc_calendar (id),

    CONSTRAINT ck_rc_item_type CHECK (item_type IN (N'appointment', N'task')),
    CONSTRAINT ck_rc_item_vis CHECK (visibility IN (N'private', N'area', N'public')),
    CONSTRAINT ck_rc_item_status CHECK (status IN
        (N'planned', N'confirmed', N'cancelled', N'completed')),
    CONSTRAINT ck_rc_item_repeat CHECK (repeat_kind IN
        (N'none', N'daily', N'weekly', N'monthly', N'yearly')),

    /* Ein Termin, der vor seinem Anfang endet, ist keine Eingabe, sondern ein
       Fehler — und er faellt sonst erst in der Wochenansicht auf.            */
    CONSTRAINT ck_rc_item_span CHECK (ends_at >= starts_at),

    CONSTRAINT ck_rc_item_every CHECK (repeat_every BETWEEN 1 AND 366),

    /* Eine Wiederholung braucht ein Ende. Genau eines von beiden. */
    CONSTRAINT ck_rc_item_repeat_end CHECK (
        repeat_kind = N'none'
     OR (repeat_until IS NOT NULL AND repeat_count IS NULL)
     OR (repeat_until IS NULL AND repeat_count IS NOT NULL)),

    /* Wochentage gehoeren zu `weekly` und sonst nirgendwohin. */
    CONSTRAINT ck_rc_item_weekdays CHECK (
        (repeat_kind = N'weekly' AND repeat_weekdays IS NOT NULL AND repeat_weekdays BETWEEN 1 AND 127)
     OR (repeat_kind <> N'weekly' AND repeat_weekdays IS NULL)),

    /* Ein Zustand gehoert zu einer Aufgabe und sonst nirgendwohin. */
    CONSTRAINT ck_rc_item_task CHECK (
        (item_type = N'task' AND task_state IN (N'todo', N'doing', N'done', N'cancelled'))
     OR (item_type = N'appointment' AND task_state IS NULL)),

    /* Versiegeltes braucht eine Epoche, und eine Epoche braucht Versiegeltes. */
    CONSTRAINT ck_rc_item_sealed CHECK (
        (epoch IS NULL AND title_sealed IS NULL AND location_sealed IS NULL AND notes_sealed IS NULL)
     OR (epoch IS NOT NULL))
);
GO

/* Die haeufigste Frage ist „was steht in diesem Zeitraum an". Sie laeuft
   ueber Kalender und Zeit — und weil die Zeiten im Klartext liegen, kann die
   Datenbank sie beantworten, ohne irgendetwas zu entschluesseln. Genau das
   ist der Gewinn der Trennung oben. */
CREATE INDEX ix_rc_item_when ON dbo.rc_calendar_item (calendar_id, starts_at, ends_at);
GO

CREATE INDEX ix_rc_item_owner ON dbo.rc_calendar_item (owner_role_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Ausnahmen einer Reihe

   Eine Wiederholung, bei der ein einzelner Termin verschoben oder abgesagt
   wird, ist der Normalfall und kein Sonderfall. Die Reihe deswegen
   aufzuloesen — jeden Termin einzeln zu schreiben — hiesse, die Regel zu
   verlieren: „jeden Montag" waere danach nicht mehr aenderbar, nur noch
   fuenfzig einzelne Zeilen.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_calendar_exception (
    seq            bigint IDENTITY(1,1) NOT NULL,
    item_id        uniqueidentifier     NOT NULL,

    /* Welches Vorkommen gemeint ist: der urspruengliche Anfang. */
    occurrence_at  datetimeoffset(7)    NOT NULL,

    /* cancelled | moved */
    kind           nvarchar(16)         NOT NULL,

    /* Bei `moved`: wohin. */
    new_starts_at  datetimeoffset(7)    NULL,
    new_ends_at    datetimeoffset(7)    NULL,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_calendar_exception PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_calendar_exception UNIQUE NONCLUSTERED (item_id, occurrence_at),
    CONSTRAINT fk_rc_exception_item FOREIGN KEY (item_id) REFERENCES dbo.rc_calendar_item (id),
    CONSTRAINT ck_rc_exception_kind CHECK (kind IN (N'cancelled', N'moved')),
    CONSTRAINT ck_rc_exception_moved CHECK (
        (kind = N'cancelled' AND new_starts_at IS NULL AND new_ends_at IS NULL)
     OR (kind = N'moved' AND new_starts_at IS NOT NULL AND new_ends_at IS NOT NULL
         AND new_ends_at >= new_starts_at))
);
GO
