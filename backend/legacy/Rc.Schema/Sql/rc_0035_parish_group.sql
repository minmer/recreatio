/*
    Gruppen einer Pfarrei — Ministranten, Schola, Oase, Caritas.

    =========================================================================
    DER GEDANKE IN EINEM SATZ
    =========================================================================

    Eine Gruppe ist ein BEREICH MIT EINER VORDERTUER.

    Alles, was eine Gruppe innen braucht, hat die Plattform schon, und zwar
    bereichsweise: Nachrichten (rc_message), Themen (rc_topic), Termine und
    Aufgaben (rc_calendar_item), Mitglieder (Zertifikate auf den Bereich),
    Schluessel (rc_area_epoch). Eine Gruppe erfindet davon NICHTS neu. Sie
    legt einen eigenen Bereich an und schreibt daneben auf, wozu er da ist.

    Das ist der ganze Unterschied zu einem blossen Bereich: ein Bereich hat
    keinen Namen, den ein Besucher lesen kann — sein Titel liegt versiegelt
    (9.13). Eine Gruppe hat einen, weil sie im Schaukasten haengt.

    =========================================================================
    WARUM EIN EIGENER BEREICH UND NICHT DER DER PFARREI
    =========================================================================

    Weil sonst jeder, der den Messplan pflegt, im Gruppenchat der
    Ministranteneltern mitlaese. Ein Bereich ist die Einheit der Sichtbarkeit;
    zwei Dinge, die verschiedene Leute angehen, gehoeren in zwei Bereiche.

    Derselbe Grund wie beim Firmjahrgang (rc_confirmation_group), und dieselbe
    Loesung. Der Unterschied: ein Firmjahrgang haengt an einem Bereich, den
    jemand VORHER angelegt hat. Das hat sich als Zumutung erwiesen — wer eine
    Gruppe gruendet, denkt nicht in Bereichen. Hier entsteht der Bereich MIT
    der Gruppe, in einer Transaktion.

    =========================================================================
    ZWEI SICHTBARKEITEN, NEBENEINANDER UND BESCHRIFTET
    =========================================================================

    Dieselbe Entscheidung wie bei der Messintention (title_public /
    title_sealed) und aus demselben Grund.

      DER AUSHANG — name, summary, meets: Klartext.

        Das haengt im Schaukasten: "Ministranci — zbiorki w soboty 10:00". Es
        zu verschluesseln waere Theater: der Dienst liefert es ohne Konto aus,
        damit es jemand lesen kann, der noch nicht dazugehoert. Ein Geheimnis,
        das man jedem zeigt, ist keines — es sieht nur so aus, und das ist
        schlimmer als Klartext, weil man sich darauf verlaesst.

      DAS INNERE — note_sealed, unter dem Epochenschluessel des Bereichs.

        "Schluessel zur Sakristei hat Frau K.", "Marek kommt nicht mehr, bitte
        nicht darauf ansprechen". Das geht die Gruppe an und sonst niemanden,
        auch nicht die Pfarrkanzlei.

    Beide Felder stehen im Formular NEBENEINANDER und beschriftet. Ein Feld
    "Info" und daneben eines "interne Info", beide gleich aussehend, waere eine
    Falle: der Unterschied stuende dann nur im Kopf dessen, der gerade tippt.

    note_epoch sagt, unter WELCHEM Schluessel die Notiz liegt. Ohne diese
    Spalte muesste der Lesepfad alle Epochen durchprobieren, und nach einem
    Schnitt saehe eine unlesbare Notiz wie eine leere aus.

    =========================================================================
    WARUM DIE MITGLIEDSROLLE AUFGESCHRIEBEN WIRD
    =========================================================================

    member_role_id ist die Rolle, die "Mitglied dieser Gruppe" BEDEUTET. Sie
    ist Mitglied des Bereichs und traegt dessen Epochenschluessel.

    Daran haengt der Beitritt per Link. Eine Einladung (3.12) versiegelt einen
    ROLLENSCHLUESSEL unter einem Geheimnis, das nur im Link steht; wer ihn
    einloest, bekommt die Rolle an seine persoenliche Rolle geknuepft — und
    damit, ueber den Rollengraphen, die Schluessel des Bereichs. Genau das
    meint "der Link laesst sich ins Konto einbinden": es entsteht eine Kante im
    Graphen, kein Sonderzugang.

    Ohne diese Spalte muesste man raten, WELCHE Rolle ein Link vergeben soll,
    und ein falsch geratener Link vergibt Schluessel an der Gruppe vorbei.

    =========================================================================
    WARUM DER KALENDER MITGESCHRIEBEN WIRD
    =========================================================================

    calendar_id — jede Gruppe bekommt beim Anlegen ihren. Ihn erst beim ersten
    Termin anzulegen hiesse: die Gruppe hat einen Kalenderreiter, der beim
    ersten Klick etwas anlegt, und zwei Leute, die gleichzeitig klicken, legen
    zwei an. Ein Kalender, der leer ist, ist kein Problem; zwei Kalender fuer
    eine Gruppe sind eines.

    Aufgaben liegen als item_type = 'task' DARIN. Eine eigene Aufgabentabelle
    waere dieselbe Sache zweimal: eine Aufgabe hat einen Termin, einen
    Zustaendigen und einen Titel — das ist ein Kalendereintrag, der abgehakt
    werden kann. Und nur so steht sie auch im Terminplan (RcAgenda) neben
    Messe und Spowiedz.
*/

IF OBJECT_ID('dbo.rc_parish_group', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.rc_parish_group
    (
        id              uniqueidentifier NOT NULL,
        parish_id       uniqueidentifier NOT NULL,
        tenant_id       uniqueidentifier NOT NULL,

        /* Der eigene Bereich: Chat, Themen, Mitglieder, Schluessel. */
        area_id         uniqueidentifier NOT NULL,

        /* Die Rolle, die "Mitglied" bedeutet — daran haengt der Beitrittslink. */
        member_role_id  uniqueidentifier NOT NULL,

        /* Termine UND Aufgaben. */
        calendar_id     uniqueidentifier NOT NULL,

        slug            nvarchar(80)  NOT NULL,
        name            nvarchar(200) NOT NULL,

        /* -- Der Aushang: Klartext, weil oeffentlich ausgeliefert ---------- */
        summary         nvarchar(400) NULL,
        meets           nvarchar(200) NULL,

        /*
            Ob die Gruppe im Schaukasten haengt.

            0 heisst NICHT "geheim" — der Inhalt ist ohnehin versiegelt —,
            sondern "steht nicht auf der Pfarrseite". Eine Gruppe, die keine
            neuen Leute sucht, muss nicht beworben werden.
        */
        is_public       bit NOT NULL
            CONSTRAINT df_rc_parish_group_public DEFAULT (1),

        /* -- Das Innere: unter dem Epochenschluessel des Bereichs ---------- */
        note_sealed     varbinary(max) NULL,
        note_epoch      int NULL,

        lifecycle       nvarchar(20) NOT NULL
            CONSTRAINT df_rc_parish_group_lifecycle DEFAULT (N'active'),
        created_at      datetimeoffset NOT NULL,

        CONSTRAINT pk_rc_parish_group PRIMARY KEY (id),

        CONSTRAINT fk_rc_parish_group_parish
            FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
        CONSTRAINT fk_rc_parish_group_area
            FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
        CONSTRAINT fk_rc_parish_group_member_role
            FOREIGN KEY (member_role_id) REFERENCES dbo.rc_role (id),
        CONSTRAINT fk_rc_parish_group_calendar
            FOREIGN KEY (calendar_id) REFERENCES dbo.rc_calendar (id),

        /*
            Eine Notiz OHNE ihre Epoche waere unlesbar und saehe leer aus.
            Die Regel gehoert hierher und nicht in den Lesepfad: dort waere
            sie eine Pruefung, hier ist sie eine Unmoeglichkeit.
        */
        CONSTRAINT ck_rc_parish_group_note
            CHECK ((note_sealed IS NULL AND note_epoch IS NULL)
                OR (note_sealed IS NOT NULL AND note_epoch IS NOT NULL)),

        CONSTRAINT ck_rc_parish_group_lifecycle
            CHECK (lifecycle IN (N'active', N'archived'))
    );
END
GO

/*
    Die Adresse ist je Pfarrei eindeutig, nicht plattformweit: zwei Pfarreien
    duerfen beide eine "ministranci" haben. Sie steht in der Adresszeile
    (#/new/parish/grzegorzki/community/ministranci) und ist damit oeffentlich —
    deshalb NICHTS darin, was jemanden verraet.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rc_parish_group_slug')
BEGIN
    CREATE UNIQUE INDEX ux_rc_parish_group_slug
        ON dbo.rc_parish_group (parish_id, slug);
END
GO

/*
    "Zu welcher Gruppe gehoert dieser Bereich" — beim Oeffnen jedes Chats.

    EINDEUTIG, nicht bloss ein Index: ein Bereich traegt hoechstens eine
    Gruppe. Zwei Gruppen auf einem Bereich haetten dasselbe Gespraech und
    dieselben Mitglieder und waeren damit dieselbe Gruppe unter zwei Namen —
    aber mit zwei Beitrittslinks, von denen einer stillschweigend in die
    falsche Gruppe fuehrt.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ux_rc_parish_group_area')
BEGIN
    CREATE UNIQUE INDEX ux_rc_parish_group_area
        ON dbo.rc_parish_group (area_id);
END
GO

/*
    =========================================================================
    DIE AUFGABE, DIE AUS EINEM GESPRAECH ENTSTAND
    =========================================================================

    Im Chat einer Gruppe steht der Satz "koennte jemand die Alben buegeln?",
    und danach vierzig weitere Saetze. Aus so einem Satz wird eine Aufgabe —
    und dann ist die Aufgabe hier und das Gespraech dort, und niemand findet
    mehr, was eigentlich gemeint war. Wer die Aufgabe liest, sieht drei Worte
    ohne den Zusammenhang, der sie erklaert.

    topic_id haelt beides zusammen.

    WARUM AM THEMA UND NICHT AN DER NACHRICHT. Eine Nachricht kann verborgen
    oder geaendert werden (9.x); ein Thema ist das, was bleibt. Und ein Thema
    entsteht ohnehin genau so, wie diese Verknuepfung entstehen soll: man
    markiert im Gespraech, was zusammengehoert, und macht ein Thema daraus
    (RcTopics.CreateAsync nimmt die Nachrichten gleich mit). Die Aufgabe haengt
    sich an dieses Thema, nicht an eine einzelne Zeile.

    WARUM DIE SCHLUESSEL PASSEN. rc_topic haengt an einem Bereich, rc_calendar
    auch. Bei einer Gruppe ist es DERSELBE Bereich — wer die Aufgabe oeffnen
    kann, kann auch das Thema oeffnen. Verwiese eine Aufgabe auf ein Thema aus
    einem fremden Bereich, stuende in der Aufgabenliste ein Verweis auf etwas,
    das der Leser nie aufbekommt. Der Dienst prueft das beim Anlegen; die
    Fremdschluessel allein koennen es nicht.

    NULL ist der Normalfall: die allermeisten Termine entstehen nicht aus einem
    Gespraech.
*/
IF COL_LENGTH('dbo.rc_calendar_item', 'topic_id') IS NULL
BEGIN
    ALTER TABLE dbo.rc_calendar_item ADD topic_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_rc_calendar_item_topic')
BEGIN
    ALTER TABLE dbo.rc_calendar_item
        ADD CONSTRAINT fk_rc_calendar_item_topic
        FOREIGN KEY (topic_id) REFERENCES dbo.rc_topic (id);
END
GO

/* "Was ist aus diesem Thema geworden" — die Frage im Themenreiter. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_calendar_item_topic')
BEGIN
    CREATE INDEX ix_rc_calendar_item_topic
        ON dbo.rc_calendar_item (topic_id)
        WHERE topic_id IS NOT NULL;
END
GO
