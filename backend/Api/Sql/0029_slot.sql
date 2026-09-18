/*
    Termine, die man sich nehmen kann.

    =========================================================================
    KEIN ZWEITER KALENDER
    =========================================================================

    Der Altbestand hatte `ParishConfirmationMeetingSlot` — eine eigene Tabelle
    mit eigener Zeit, eigener Dauer, eigenem Etikett, neben dem Kalender. Damit
    stand die Firmung in einem Kalender, den der Messplan nicht kannte, und ein
    Mensch, der wissen wollte, was am Samstag los ist, musste an zwei Stellen
    nachsehen.

    Hier ist ein Termin ein KALENDEREINTRAG (`app.calendar_item`, kind
    `appointment`) wie jeder andere. Er hat schon Anfang, Ende, Wiederholung,
    versiegelten Titel und einen Bereich, der sagt, wer ihn sieht. Was ihm
    fehlt, ist allein die Frage: kann man sich daraufsetzen, und wer sitzt schon
    darauf.

    =========================================================================
    JE VORKOMMEN, NICHT JE EINTRAG
    =========================================================================

    „Spotkanie, sobota 10:00, woechentlich" ist EIN Eintrag mit vielen
    Vorkommen. Gebucht wird nicht die Reihe, sondern der 14. November.

    Genau diese Form gibt es hier schon: `app.mass_intention` haengt an
    `(item_id, occurrence_at)` und nicht an einer eigenen Zeile je Messe. Die
    Buchung macht es gleich — nicht aus Sparsamkeit, sondern weil es dasselbe
    Problem ist, und zwei Loesungen dafuer waeren eine zu viel.

    =========================================================================
    WER SITZT DARAUF
    =========================================================================

    Ein Firmling hat kein Konto. Er hat einen PLATZ (`app.access`, 0022/0027) —
    und der ist hier der Ausweis. Wer ein Konto hat, kommt mit seiner Rolle;
    beides ist erlaubt, mindestens eines muss dastehen.

    =========================================================================
    DIE REGEL DES ALTBESTANDS, UNVERAENDERT
    =========================================================================

    Sie stand in `EvaluateConfirmationMeetingJoinStatus` und war gut:

        besetzt >= Plaetze                 -> voll
        besetzt == 0                       -> frei; wer nimmt, wird GASTGEBER
        Einladungsfenster offen (72 h):
            Gastgeber oder richtiger Code  -> frei
            sonst                          -> Einladung noetig
        Fenster zu:
            besetzt == 1                   -> frei fuer alle
            sonst                          -> zu

    <b>Warum das Fenster.</b> Wer zuerst zugreift, soll sich aussuchen duerfen,
    mit wem er hingeht — drei Tage lang. Danach faellt ein Termin, auf dem erst
    einer sitzt, wieder an alle: sonst blockierte ein einzelner Platz einen
    ganzen Termin, bloss weil niemand seinen Code bekommen hat.

    <b>Der Code wird NICHT im Klartext gespeichert.</b> Nur sein SHA-256 — wie
    bei jedem anderen Geheimnis hier. Der Gastgeber sieht ihn beim Buchen genau
    einmal; verliert er ihn, bekommt er einen neuen.

    =========================================================================
    ODER FRAGEN STATT CODE
    =========================================================================

    Der zweite Weg des Altbestands: nicht jeder hat den Code, aber jeder kann
    fragen. `app.slot_request` traegt die Frage und die Antwort des Gastgebers.
    Sie ist kein zweiter Buchungsweg — angenommen wird sie, indem der Dienst
    dieselbe Buchung schreibt, die auch ein Code erzeugt haette.
*/

/* -------------------------------------------------------------------------
   1. Das Vorkommen, das man buchen kann
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'item_slot')
BEGIN
    CREATE TABLE app.item_slot
    (
        item_id       uniqueidentifier NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,

        /*
            Wie viele daraufpassen. Der Altbestand liess 2 bis 3; hier steht
            keine Obergrenze in der Datenbank — ein Termin fuer zwoelf ist
            denkbar, und die Kanzlei weiss besser als diese Zeile, wofuer.
        */
        capacity      int NOT NULL CONSTRAINT ck_item_slot_capacity CHECK (capacity >= 1),

        /*
            Wer zuerst zugriff. Er darf waehrend des Fensters einladen — und er
            ist derjenige, den eine Bitte um Mitnahme erreicht.
        */
        host_access_id uniqueidentifier NULL,
        host_role_id   uniqueidentifier NULL,

        /* Das Geheimnis selbst steht nirgends. */
        invite_sha256  varbinary(32) NULL,
        invite_until   datetimeoffset(7) NULL,

        created_at    datetimeoffset(7) NOT NULL,
        updated_at    datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_item_slot PRIMARY KEY (item_id, occurrence_at),
        CONSTRAINT fk_item_slot_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id),
        CONSTRAINT fk_item_slot_host_access FOREIGN KEY (host_access_id) REFERENCES app.access (id),
        CONSTRAINT fk_item_slot_host_role FOREIGN KEY (host_role_id) REFERENCES app.role (id)
    );
END
GO

/* -------------------------------------------------------------------------
   2. Wer daraufsitzt
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'slot_booking')
BEGIN
    CREATE TABLE app.slot_booking
    (
        id            uniqueidentifier NOT NULL,

        item_id       uniqueidentifier NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,

        /* Ein Platz ODER eine Rolle — ohne Konto gibt es nur das erste. */
        access_id     uniqueidentifier NULL,
        role_id       uniqueidentifier NULL,

        booked_at     datetimeoffset(7) NOT NULL,

        /*
            Zurueckgegeben. Die Zeile BLEIBT: die Kanzlei soll sehen, dass da
            einmal jemand sass — und wer zweimal bucht und zweimal absagt, ist
            eine Auskunft, kein Nichts.
        */
        released_at   datetimeoffset(7) NULL,

        CONSTRAINT pk_slot_booking PRIMARY KEY (id),
        CONSTRAINT fk_slot_booking_slot
            FOREIGN KEY (item_id, occurrence_at) REFERENCES app.item_slot (item_id, occurrence_at),
        CONSTRAINT fk_slot_booking_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_slot_booking_role FOREIGN KEY (role_id) REFERENCES app.role (id),

        CONSTRAINT ck_slot_booking_who
            CHECK (access_id IS NOT NULL OR role_id IS NOT NULL)
    );
END
GO

/*
    ZWEIMAL DERSELBE MENSCH AUF DEMSELBEN TERMIN GEHT NICHT — und zwar als
    Regel der Datenbank und nicht als Pruefung im Dienst. Zwei Anfragen im
    selben Augenblick koennen beide „noch ist Platz" lesen; nur ein eindeutiger
    Index entscheidet das.

    Gefiltert auf die offenen: wer zurueckgibt und es sich anders ueberlegt,
    darf wieder buchen.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_slot_booking_access')
    CREATE UNIQUE INDEX uq_slot_booking_access
        ON app.slot_booking (item_id, occurrence_at, access_id)
        WHERE released_at IS NULL AND access_id IS NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_slot_booking_role')
    CREATE UNIQUE INDEX uq_slot_booking_role
        ON app.slot_booking (item_id, occurrence_at, role_id)
        WHERE released_at IS NULL AND role_id IS NOT NULL;
GO

/* „Worauf sitzt DIESER Mensch" — die Frage des Portals, bei jedem Aufschlagen. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slot_booking_access')
    CREATE INDEX ix_slot_booking_access ON app.slot_booking (access_id)
        WHERE access_id IS NOT NULL AND released_at IS NULL;
GO

/* -------------------------------------------------------------------------
   3. Fragen statt Code

   Der zweite Weg hinein: wer den Code nicht hat, fragt den Gastgeber. Die
   Annahme schreibt dieselbe Buchung, die auch ein Code erzeugt haette — es
   gibt nur EINEN Weg, auf einen Termin zu kommen.
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'slot_request')
BEGIN
    CREATE TABLE app.slot_request
    (
        id            uniqueidentifier NOT NULL,

        item_id       uniqueidentifier NOT NULL,
        occurrence_at datetimeoffset(7) NOT NULL,

        /* Wer fragt. Ohne Konto ist das ein Platz. */
        asked_by_access_id uniqueidentifier NULL,
        asked_by_role_id   uniqueidentifier NULL,

        /*
            'pending'  — der Gastgeber hat noch nicht geantwortet
            'accepted' — er hat ja gesagt; die Buchung steht daneben
            'declined' — er hat nein gesagt
            'withdrawn'— der Fragende hat es sich anders ueberlegt
        */
        status        nvarchar(16) NOT NULL CONSTRAINT df_slot_request_status DEFAULT (N'pending'),

        created_at    datetimeoffset(7) NOT NULL,
        decided_at    datetimeoffset(7) NULL,

        CONSTRAINT pk_slot_request PRIMARY KEY (id),
        CONSTRAINT fk_slot_request_slot
            FOREIGN KEY (item_id, occurrence_at) REFERENCES app.item_slot (item_id, occurrence_at),
        CONSTRAINT fk_slot_request_access FOREIGN KEY (asked_by_access_id) REFERENCES app.access (id),
        CONSTRAINT fk_slot_request_role FOREIGN KEY (asked_by_role_id) REFERENCES app.role (id),

        CONSTRAINT ck_slot_request_who
            CHECK (asked_by_access_id IS NOT NULL OR asked_by_role_id IS NOT NULL),

        CONSTRAINT ck_slot_request_status
            CHECK (status IN (N'pending', N'accepted', N'declined', N'withdrawn'))
    );
END
GO

/* Zweimal dieselbe offene Frage ist keine zweite Frage. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_slot_request_open')
    CREATE UNIQUE INDEX uq_slot_request_open
        ON app.slot_request (item_id, occurrence_at, asked_by_access_id)
        WHERE status = N'pending' AND asked_by_access_id IS NOT NULL;
GO

/* „Was liegt bei MIR zur Entscheidung" — die Frage des Gastgebers. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slot_request_open')
    CREATE INDEX ix_slot_request_open ON app.slot_request (item_id, occurrence_at)
        WHERE status = N'pending';
GO
