/*
    Etwas, das man sich fuer eine Zeit nehmen kann — und wer es sich nimmt.

    =========================================================================
    ZWEI FAELLE, EINE SACHE
    =========================================================================

    Ein Firmling sucht sich ein Treffen mit dem Priester aus. Eine Gruppe
    fragt nach dem Haus in Hortus Dei fuer drei Naechte und der Kapelle fuer
    einen Nachmittag. Das sieht nach zwei Dingen aus und ist eines: JEMAND
    NIMMT SICH EINEN TEIL VON ETWAS BEGRENZTEM, FUER EINE ZEIT.

        die Zeit des Priesters    ein Raum, ein Haus     ->  app.resource
        ein Treffen               ein Aufenthalt         ->  app.claim

    Was sich unterscheidet, sind REGELN am Ding, nicht zwei Systeme:

                                Priester         Hortus Dei
        wer waehlt die Zeit     die Kanzlei      wer fragt
        was zaehlt die Grenze   je Termin        was gleichzeitig ist
        Puffer                  keiner           Reinigung davor/danach
        wer bestaetigt          niemand          die Kanzlei
        Gastgeber darf laden    ja, 72 h         nein
        wer haelt es            ein Platz        ein Platz, oder eine Rolle

    Der Altbestand hatte beides zweimal: `ParishConfirmationMeetingSlot` fuer
    die Firmung, `hortus.HortusReservationItem` fuer den Ort — zwei Tabellen,
    zwei Pruefungen, zwei Arten, „ist das noch frei" zu beantworten. Und die
    eine davon (0029) hatte einen Fehler, den die andere nie bekommen durfte:
    sie zaehlte die belegten Plaetze und schrieb die Buchung in einem ZWEITEN
    Schritt, ohne Sperre. Zwei Menschen im selben Augenblick lasen beide
    „noch ein Platz frei", und beide bekamen ihn.

    =========================================================================
    WANN MAN SICH ETWAS NEHMEN KANN, STEHT IM KALENDER
    =========================================================================

    Ein Ding hat einen Kalender (`calendar_id`). Wer die Zeit vorgibt
    (`mode = 'offered'`), legt dort Termine an — genau das tat die Kanzlei
    schon fuer „Spotkania": neun Termine, alle buchbar. Es gibt deshalb keine
    Tabelle „welches Vorkommen ist buchbar": jeder Termin (`kind =
    'appointment'`) im Kalender des Dings IST ein Angebot, und wer einen
    streichen will, streicht ihn im Kalender.

    Wer die Zeit selbst waehlt (`mode = 'open'`), braucht keine Angebote. Er
    schlaegt vor; die Grenze entscheidet, ob es passt.

    =========================================================================
    WER ES HAELT
    =========================================================================

    Ein Firmling hat kein Konto — er hat einen PLATZ (`app.access`). Eine
    Gruppe, die nach Hortus Dei fragt, hat auch keines; im Altbestand bekam sie
    einen Code und einen Link, dessen Abdruck gespeichert wurde. DAS IST EIN
    PLATZ. Ab hier fragt sie ueber ein Formular — ihre Angaben liegen
    versiegelt, nicht im Klartext wie im Altbestand — und haelt ihre Anfrage
    ueber den Platz, den das Formular erzeugt.
*/

/* -------------------------------------------------------------------------
   1. Das Ding
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'resource')
BEGIN
    CREATE TABLE app.resource
    (
        id              uniqueidentifier NOT NULL,

        /* Wer es fuehrt — und unter wessen Schluessel die Angaben liegen. */
        area_id         uniqueidentifier NOT NULL,

        /*
            Worin es liegt. Hortus Dei ist ein Baum: der ganze Ort, darin die
            Haeuser und der Garten, darin die Zimmer, die Kapelle, der Grill.
            Wer das Haus nimmt, nimmt die Zimmer mit — das prueft der Dienst
            ueber diese Spalte.
        */
        parent_id       uniqueidentifier NULL,

        /* Wo seine Angebote stehen. Ohne Kalender gibt es nur `open`. */
        calendar_id     uniqueidentifier NULL,

        /* Offen: es steht auf einer oeffentlichen Seite. */
        name            nvarchar(200) NOT NULL,

        /* Nur fuer die Worte und das Bild: person | room | house | place | other. */
        kind            nvarchar(16) NOT NULL CONSTRAINT df_resource_kind DEFAULT (N'other'),

        /* offered: die Kanzlei gibt die Zeiten vor. open: wer fragt, schlaegt vor. */
        mode            nvarchar(8) NOT NULL CONSTRAINT df_resource_mode DEFAULT (N'offered'),

        /*
            Bei `open`: nach Naechten (Anreise/Abreise) oder nach Minuten.
            Die Zeiten fuer An- und Abreise stehen hier, weil sie zum Ding
            gehoeren und nicht zu dem, der fragt.
        */
        by_night        bit NOT NULL CONSTRAINT df_resource_by_night DEFAULT (0),
        check_in_min    int NOT NULL CONSTRAINT df_resource_check_in DEFAULT (960),   /* 16:00 */
        check_out_min   int NOT NULL CONSTRAINT df_resource_check_out DEFAULT (600),  /* 10:00 */

        /* Wie viele gleichzeitig. Beim Priester: je Termin. Beim Raum: je Moment. */
        capacity        int NOT NULL CONSTRAINT df_resource_capacity DEFAULT (1),

        /* Reinigen, Lueften, Auffuellen — so lange bleibt der Naechste draussen. */
        buffer_before   int NOT NULL CONSTRAINT df_resource_buffer_before DEFAULT (0),
        buffer_after    int NOT NULL CONSTRAINT df_resource_buffer_after DEFAULT (0),

        /* none: wer passt, hat es. office: die Kanzlei sagt ja oder nein. */
        approval        nvarchar(8) NOT NULL CONSTRAINT df_resource_approval DEFAULT (N'none'),

        /* Wie lange der Erste aussuchen darf, wer mitkommt. 0 = gar nicht. */
        invite_hours    int NOT NULL CONSTRAINT df_resource_invite DEFAULT (0),

        /* Wie viele Tage im Voraus mindestens. */
        lead_days       int NOT NULL CONSTRAINT df_resource_lead DEFAULT (0),

        created_at      datetimeoffset(7) NOT NULL,
        updated_at      datetimeoffset(7) NOT NULL,

        CONSTRAINT pk_resource PRIMARY KEY (id),
        CONSTRAINT fk_resource_area FOREIGN KEY (area_id) REFERENCES app.area (id),
        CONSTRAINT fk_resource_parent FOREIGN KEY (parent_id) REFERENCES app.resource (id),
        CONSTRAINT fk_resource_calendar FOREIGN KEY (calendar_id) REFERENCES app.calendar (id),

        CONSTRAINT ck_resource_kind CHECK (kind IN (N'person', N'room', N'house', N'place', N'other')),
        CONSTRAINT ck_resource_mode CHECK (mode IN (N'offered', N'open')),
        CONSTRAINT ck_resource_approval CHECK (approval IN (N'none', N'office')),
        CONSTRAINT ck_resource_capacity CHECK (capacity >= 1),
        CONSTRAINT ck_resource_buffers CHECK (buffer_before >= 0 AND buffer_after >= 0),
        CONSTRAINT ck_resource_invite CHECK (invite_hours >= 0),
        CONSTRAINT ck_resource_lead CHECK (lead_days >= 0),
        CONSTRAINT ck_resource_times CHECK (check_in_min BETWEEN 0 AND 1439 AND check_out_min BETWEEN 0 AND 1439),
        CONSTRAINT ck_resource_not_self CHECK (parent_id IS NULL OR parent_id <> id),

        /* Wer Termine vorgibt, braucht einen Ort, an dem sie stehen. */
        CONSTRAINT ck_resource_offered_calendar CHECK (mode = N'open' OR calendar_id IS NOT NULL)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_resource_area')
    CREATE INDEX ix_resource_area ON app.resource (area_id);
GO

/* „Welches Ding gehoert zu diesem Kalender" — so findet ein vorhandener
   Terminbaustein (`slots`, config `calendar`) sein Ding, ohne dass jemand
   seine Einstellung anfassen muss. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_resource_calendar')
    CREATE INDEX ix_resource_calendar ON app.resource (calendar_id) WHERE calendar_id IS NOT NULL;
GO

/* -------------------------------------------------------------------------
   2. Wer es sich nimmt
   ------------------------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.tables t
               JOIN sys.schemas s ON s.schema_id = t.schema_id
               WHERE s.name = 'app' AND t.name = 'claim')
BEGIN
    CREATE TABLE app.claim
    (
        id              uniqueidentifier NOT NULL,
        resource_id     uniqueidentifier NOT NULL,

        /* Die Zeit, in der man DRIN ist — ohne die Puffer, die rechnet der Dienst. */
        starts_at       datetimeoffset(7) NOT NULL,
        ends_at         datetimeoffset(7) NOT NULL,

        /*
            Bei `offered`: WELCHES Angebot. Die Zeit allein genuegte nicht —
            zwei Termine duerfen sich ueberschneiden (in „Spotkania" tun es
            zwei), und dann zaehlt die Grenze je Termin, nicht je Minute.
            Am urspruenglichen Beginn des Vorkommens, wie bei den Intentionen.
        */
        item_id         uniqueidentifier NULL,
        occurrence_at   datetimeoffset(7) NULL,

        /* Ein Platz ODER eine Rolle — ohne Konto gibt es nur das erste. */
        access_id       uniqueidentifier NULL,
        role_id         uniqueidentifier NULL,

        /*
            Was zusammengehoert. Eine Gruppe nimmt das Haus fuer drei Naechte
            UND die Kapelle fuer zwei Stunden — das ist EINE Anfrage, und die
            Kanzlei sagt zu beiden auf einmal ja. Allein ist man seine eigene
            Gruppe.
        */
        group_id        uniqueidentifier NOT NULL,

        /*
            pending   — wartet auf ein Ja (der Kanzlei oder des Gastgebers)
            confirmed — steht
            declined  — nein
            released  — zurueckgegeben

            Wartendes ZAEHLT gegen die Grenze. Sonst zeigte der Kalender frei,
            was schon erfragt ist, und die Kanzlei muesste Menschen absagen,
            nachdem sie geplant haben.
        */
        status          nvarchar(12) NOT NULL,

        /* Wer das Ja geben muss, solange es wartet: office | host. */
        awaits          nvarchar(8) NULL,

        /*
            Der Gastgeber eines Termins — der Erste darauf, bei `invite_hours
            > 0`. Nur der Abdruck des Codes; der Code steht einmal in der
            Antwort und nirgends sonst.
        */
        invite_sha256   varbinary(32) NULL,
        invite_until    datetimeoffset(7) NULL,

        created_at      datetimeoffset(7) NOT NULL,
        decided_at      datetimeoffset(7) NULL,
        released_at     datetimeoffset(7) NULL,

        CONSTRAINT pk_claim PRIMARY KEY (id),
        CONSTRAINT fk_claim_resource FOREIGN KEY (resource_id) REFERENCES app.resource (id),
        CONSTRAINT fk_claim_item FOREIGN KEY (item_id) REFERENCES app.calendar_item (id),
        CONSTRAINT fk_claim_access FOREIGN KEY (access_id) REFERENCES app.access (id),
        CONSTRAINT fk_claim_role FOREIGN KEY (role_id) REFERENCES app.role (id),

        CONSTRAINT ck_claim_who CHECK (access_id IS NOT NULL OR role_id IS NOT NULL),
        CONSTRAINT ck_claim_span CHECK (ends_at > starts_at),
        CONSTRAINT ck_claim_status CHECK (status IN (N'pending', N'confirmed', N'declined', N'released')),
        CONSTRAINT ck_claim_awaits CHECK (
            (status = N'pending' AND awaits IN (N'office', N'host'))
            OR (status <> N'pending' AND awaits IS NULL)),
        /* Beide oder keins — ein Termin ohne Vorkommen ist keiner. */
        CONSTRAINT ck_claim_offer CHECK (
            (item_id IS NULL AND occurrence_at IS NULL)
            OR (item_id IS NOT NULL AND occurrence_at IS NOT NULL))
    );
END
GO

/*
    ZWEIMAL DERSELBE AUF DEMSELBEN TERMIN GEHT NICHT — als Regel der Datenbank,
    wie in 0029. Die Grenze selbst (wie VIELE) haelt die Sperre im Dienst; die
    kann ein Index nicht, weil sie zaehlt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_claim_offer_access')
    CREATE UNIQUE INDEX uq_claim_offer_access
        ON app.claim (item_id, occurrence_at, access_id)
        WHERE item_id IS NOT NULL AND access_id IS NOT NULL
          AND status IN (N'pending', N'confirmed');
GO

/* „Was ist hier gerade belegt" — die Frage jeder Pruefung. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_claim_resource_live')
    CREATE INDEX ix_claim_resource_live ON app.claim (resource_id, starts_at, ends_at)
        WHERE status IN (N'pending', N'confirmed');
GO

/* „Was halte ICH" — die Frage des Portals. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_claim_access')
    CREATE INDEX ix_claim_access ON app.claim (access_id) WHERE access_id IS NOT NULL;
GO

/* -------------------------------------------------------------------------
   3. Was schon dasteht, zieht um

   Die Kanzlei hat in „Spotkania" neun Termine zum Buchen geoeffnet, alle mit
   drei Plaetzen, und noch hat niemand gebucht. Daraus wird EIN Ding je
   Kalender: angeboten, drei Plaetze, 72 Stunden fuer den Gastgeber — die
   Regel von 0029, unveraendert.

   Die Zahl der Plaetze war in 0029 je Vorkommen gespeichert; hier gilt sie
   fuer das Ding. Wo sie sich unterschied, gewinnt die groesste — niemand
   verliert einen Platz, den er schon gesehen hat.

   Buchungen gibt es keine (`slot_booking` ist leer); waeren welche da,
   stuenden sie unten mit derselben Anweisung. Die alten Tabellen bleiben
   stehen und werden nicht mehr beschrieben.
   ------------------------------------------------------------------------- */

INSERT INTO app.resource
    (id, area_id, calendar_id, name, kind, mode, capacity, approval, invite_hours,
     created_at, updated_at)
SELECT NEWID(), c.area_id, c.id, c.title, N'person', N'offered',
       MAX(s.capacity), N'none', 72, SYSDATETIMEOFFSET(), SYSDATETIMEOFFSET()
FROM app.item_slot s
JOIN app.calendar_item i ON i.id = s.item_id
JOIN app.calendar c ON c.id = i.calendar_id
WHERE NOT EXISTS (SELECT 1 FROM app.resource r WHERE r.calendar_id = c.id)
GROUP BY c.id, c.area_id, c.title;
GO

INSERT INTO app.claim
    (id, resource_id, starts_at, ends_at, item_id, occurrence_at, access_id, role_id,
     group_id, status, awaits, created_at, released_at)
SELECT b.id, r.id, b.occurrence_at,
       DATEADD(minute, DATEDIFF(minute, i.starts_at, i.ends_at), b.occurrence_at),
       b.item_id, b.occurrence_at, b.access_id, b.role_id,
       b.id,
       CASE WHEN b.released_at IS NULL THEN N'confirmed' ELSE N'released' END,
       NULL, b.booked_at, b.released_at
FROM app.slot_booking b
JOIN app.calendar_item i ON i.id = b.item_id
JOIN app.resource r ON r.calendar_id = i.calendar_id
WHERE NOT EXISTS (SELECT 1 FROM app.claim c WHERE c.id = b.id);
GO
