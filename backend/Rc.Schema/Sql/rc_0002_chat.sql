/* ===========================================================================
   rc_0002_chat — Bereiche, Epochen, Nachrichten, Themen, Beschluesse
   Anhang F 24.4, uebersetzt nach SQL Server.

   Zwei Stellen weichen bewusst von Anhang F ab. Beide sind im Pruefbericht
   als Befund gemeldet und hier so umgesetzt, wie der Fliesstext es verlangt:

   BEFUND 27 — rc_poll_vote bekommt einen eigenen Schluessel und cast_at.
     Anhang F hatte PRIMARY KEY (poll_id, role_id). Damit kann es je Rolle
     genau eine Zeile geben, und eine geaenderte Stimme ueberschreibt die
     alte. 9.5 verlangt aber: "Die letzte gueltige Stimme je Rolle zaehlt;
     aeltere bleiben sichtbar (Grundsatz 5: nichts wird ueberschrieben)."

   BEFUND 28 — Ausblenden hat zwei Faelle, nicht einen.
     Anhang F kommentierte author_role_id mit "NULL nach Ausblenden" ohne
     Fallunterscheidung. 9.17 unterscheidet: beim Urheber verschwindet die
     Urheberangabe, beim Administrator BLEIBT sie — sonst waere die zugesagte
     Umkehrbarkeit nicht moeglich. Die Regel steht jetzt als CHECK in der
     Datenbank und nicht nur in der Prosa.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Ohne diese beiden schlagen gefilterte Indizes und Ausloeser fehl: sqlcmd
   startet mit QUOTED_IDENTIFIER OFF, und der Wert wird beim Anlegen eines
   Ausloesers festgeschrieben. Gefunden beim ersten echten Lauf. */
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* Kein Waechter im Skript — siehe die Begruendung in rc_0001_kernel.sql:
   RETURN verlaesst nur den eigenen Stapel. Wiedereintritt gehoert dem
   Migrationslauf. */

/* Die Transaktion gehoert dem Migrationslauf, nicht dem Skript: GO teilt in
   Stapel, und nach einem Abbruch findet COMMIT sein BEGIN nicht mehr — dann
   meldet das Skript Erfolg, obwohl zurueckgerollt wurde. */

/* ---------------------------------------------------------------------------
   Bereich: ein Schluessel, eine Kette (E-52).
   Sichtbarkeit ist kryptografisch, Thema ist organisatorisch. Die beiden
   Achsen werden nie vermischt (9.1).
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_area (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    tenant_id      uniqueidentifier     NOT NULL,
    title_sealed   varbinary(1024)      NOT NULL,
    ledger_id      uniqueidentifier     NOT NULL,
    current_epoch  int                  NOT NULL CONSTRAINT df_rc_area_epoch DEFAULT 1,

    /* 9.14.2: verlassen, archivieren und schliessen sind drei verschiedene
       Dinge. open | archived | closed                                         */
    lifecycle      nvarchar(16)         NOT NULL CONSTRAINT df_rc_area_life DEFAULT N'open',

    /* 9.14.4: DM = Gruppe mit zwei Mitgliedern. Genau ein kanonisches
       Gespraech je Personenpaar (E-126) — die Eindeutigkeit erzwingt
       dm_pair_key, gebildet aus den sortierten Rollen-IDs.                    */
    is_direct      bit                  NOT NULL CONSTRAINT df_rc_area_direct DEFAULT 0,
    dm_pair_key    nvarchar(80)         NULL,

    /* 9.14.5: Oeffentliche Boards entstehen als solche. Es gibt keine
       Umwandlung privat -> oeffentlich (E-129).                               */
    is_public      bit                  NOT NULL CONSTRAINT df_rc_area_public DEFAULT 0,

    /* 4.3: "Mitgliedschaft erfordert Aufsichts-Kante" (E-27).                 */
    requires_supervision bit            NOT NULL CONSTRAINT df_rc_area_sup DEFAULT 0,

    /* 9.9.1: Die Leitung kann Lesebestaetigungen fuer den Bereich abschalten —
       aber niemals erzwingen (E-278).                                         */
    receipts_enabled bit                NOT NULL CONSTRAINT df_rc_area_receipts DEFAULT 1,

    home_store     smallint             NOT NULL CONSTRAINT df_rc_area_home DEFAULT 0,
    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_area PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_area_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT ck_rc_area_life CHECK (lifecycle IN (N'open', N'archived', N'closed')),
    CONSTRAINT ck_rc_area_dm CHECK ((is_direct = 0 AND dm_pair_key IS NULL)
                                 OR (is_direct = 1 AND dm_pair_key IS NOT NULL))
);
CREATE UNIQUE INDEX uq_rc_area_dm ON dbo.rc_area (dm_pair_key) WHERE dm_pair_key IS NOT NULL;
CREATE INDEX ix_rc_area_tenant ON dbo.rc_area (tenant_id, lifecycle);
GO

/* 9.12.5: Beim Ausscheiden wird ein Epochenschnitt gelegt, die Historie NICHT
   neu verschluesselt. Wer ging, behaelt den alten Epochenschluessel und damit
   Zugang zu dem, was er ohnehin gelesen hat; alles Neue liegt unter der neuen
   Epoche und ist fuer ihn unlesbar.

   Der Schluessel selbst liegt NUR in rc_role_key_grant, nie hier (24.5).       */
CREATE TABLE dbo.rc_area_epoch (
    area_id     uniqueidentifier  NOT NULL,
    epoch       int               NOT NULL,
    created_at  datetimeoffset(7) NOT NULL,
    reason      nvarchar(24)      NOT NULL,   -- initial | member_left | member_added | rotation

    CONSTRAINT pk_rc_area_epoch PRIMARY KEY CLUSTERED (area_id, epoch),
    CONSTRAINT fk_rc_area_epoch_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_area_epoch_reason CHECK (reason IN
        (N'initial', N'member_left', N'member_added', N'rotation'))
);
GO

/* ---------------------------------------------------------------------------
   Nachrichten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_message (
    seq                 bigint IDENTITY(1,1) NOT NULL,
    id                  uniqueidentifier     NOT NULL,
    area_id             uniqueidentifier     NOT NULL,
    epoch               int                  NOT NULL,

    /* 9.17 / BEFUND 28: NULL nur beim Ausblenden durch den Urheber. */
    author_role_id      uniqueidentifier     NULL,

    /* 3.3: Dual Authorship. Beide werden gespeichert, nur die Rolle wird
       angezeigt. Der Account bleibt fuer Stellvertretung und Zurechenbarkeit.
       BEFUND 07 aus dem ersten Bericht: die Kennung wird NICHT im normalen
       Lesepfad ausgeliefert (3.4) — deshalb liegt sie in einer eigenen
       Tabelle, die der Lesepfad nicht joint.                                  */

    body_sealed         varbinary(max)       NULL,
    version             int                  NOT NULL CONSTRAINT df_rc_message_ver DEFAULT 1,
    posted_at           datetimeoffset(7)    NOT NULL,
    edited_at           datetimeoffset(7)    NULL,

    /* 9.6.6 / E-270: Die Frist laeuft ab dem letzten Absenden, nicht ab
       Beginn des Schreibens. Jede Anfuegung verlaengert sie.                  */
    append_window_until datetimeoffset(7)    NULL,

    /* 9.6.7: Zitat verweist auf den Hash der zitierten Fassung. Sie wandert
       NICHT mit, wenn das Original spaeter bearbeitet wird — sonst koennte
       jemand eine Aussage nachtraeglich aendern und das Zitat mitveraendern.  */
    quote_message_id    uniqueidentifier     NULL,
    quote_body_hash     varbinary(32)        NULL,

    hidden_at           datetimeoffset(7)    NULL,
    hidden_kind         tinyint              NULL,   -- 1 = durch Urheber, 2 = nichtkonform
    hidden_by_role_id   uniqueidentifier     NULL,

    /* 7.8 / E-263: nullbar. Kettenpflicht wird JE BEITRAG entschieden, nicht
       je Bereich. Fehlt die Angabe, entsteht kein Eintrag — sichere
       Voreinstellung, und kein Sicherheitsverlust: der Beitrag ist trotzdem
       verschluesselt, zugeordnet und versioniert.                             */
    ledger_entry_id     uniqueidentifier     NULL,

    CONSTRAINT pk_rc_message PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_message_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_message_epoch FOREIGN KEY (area_id, epoch)
        REFERENCES dbo.rc_area_epoch (area_id, epoch),

    CONSTRAINT ck_rc_message_hidden_kind CHECK (hidden_kind IS NULL OR hidden_kind IN (1, 2)),
    CONSTRAINT ck_rc_message_hidden_pair CHECK (
        (hidden_at IS NULL AND hidden_kind IS NULL)
     OR (hidden_at IS NOT NULL AND hidden_kind IS NOT NULL)),

    /* BEFUND 28 — die eigentliche Regel, jetzt in der Datenbank:
       Ausblenden durch den Urheber (1): Text wird nicht mehr ausgeliefert UND
       die Urheberangabe verschwindet. Was bleibt, ist ein anonymer Grabstein.
       Ausblenden durch den Administrator (2): beides bleibt liegen, damit die
       Entscheidung umkehrbar ist.                                             */
    CONSTRAINT ck_rc_message_hide_semantics CHECK (
        hidden_kind IS NULL
     OR (hidden_kind = 1 AND author_role_id IS NULL AND body_sealed IS NULL)
     OR (hidden_kind = 2 AND author_role_id IS NOT NULL AND body_sealed IS NOT NULL)),

    /* Solange nicht ausgeblendet, muessen Urheber und Text vorhanden sein. */
    CONSTRAINT ck_rc_message_visible CHECK (
        hidden_at IS NOT NULL
     OR (author_role_id IS NOT NULL AND body_sealed IS NOT NULL))
);
CREATE INDEX ix_rc_message_feed ON dbo.rc_message (area_id, seq DESC);
CREATE INDEX ix_rc_message_author ON dbo.rc_message (author_role_id) WHERE author_role_id IS NOT NULL;
GO

/* 3.3 / 3.4: Die technische Herkunft liegt getrennt. Der normale Lesepfad
   joint diese Tabelle NICHT — waere die Kennung eine Spalte auf rc_message,
   muesste jeder kuenftige Endpunkt daran denken, sie zu entfernen. Genau so
   ist der heutige Zustand im Altsystem entstanden.                            */
CREATE TABLE dbo.rc_message_attribution (
    message_id  uniqueidentifier NOT NULL,
    account_id  uniqueidentifier NOT NULL,
    created_at  datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_message_attribution PRIMARY KEY CLUSTERED (message_id),
    CONSTRAINT fk_rc_message_attribution_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id)
);
GO

/* 9.6.5: Bearbeiten ist unbegrenzt, jede Version wird angehaengt, nichts wird
   ueberschrieben. Der Klient zeigt die neueste Fassung; auf Klick erscheint
   die Versionsliste mit Zeitpunkt, Signatur und markierten Aenderungen.       */
CREATE TABLE dbo.rc_message_version (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    message_id   uniqueidentifier     NOT NULL,
    version      int                  NOT NULL,
    body_sealed  varbinary(max)       NOT NULL,
    created_at   datetimeoffset(7)    NOT NULL,
    signature    varbinary(1024)      NOT NULL,

    CONSTRAINT pk_rc_message_version PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_message_version_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_message_version_no UNIQUE NONCLUSTERED (message_id, version),
    CONSTRAINT fk_rc_message_version_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id)
);
GO

/* 9.6.2: Entwuerfe sind die EINZIGE Ausnahme von Grundsatz 5 — sie duerfen
   ueberschrieben werden. Eigene schmale Tabelle ohne Kettenanhang und ohne
   Historie, weil sie alle paar Sekunden geschrieben wird.                     */
CREATE TABLE dbo.rc_draft (
    area_id     uniqueidentifier  NOT NULL,
    role_id     uniqueidentifier  NOT NULL,
    body_sealed varbinary(max)    NOT NULL,
    updated_at  datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_draft PRIMARY KEY CLUSTERED (area_id, role_id)
);
GO

/* ---------------------------------------------------------------------------
   Themen und Beschluesse
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_topic (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    area_id         uniqueidentifier     NOT NULL,
    title_sealed    varbinary(1024)      NOT NULL,   -- 9.3.9: getippt, nie abgeleitet
    parent_topic_id uniqueidentifier     NULL,       -- 9.3.1: verschachtelbar
    created_at      datetimeoffset(7)    NOT NULL,

    /* 9.3.2: genau zwei Zustaende. Alle Nuancen laufen ueber Labels — jeder
       zusaetzliche Zustand erzeugt Diskussionen darueber, was er bedeutet,
       und niemand pflegt ihn.                                                 */
    closed_at       datetimeoffset(7)    NULL,
    closed_by_role_id uniqueidentifier   NULL,

    /* 9.3.7: Duplikat ist nur ein beidseitiger Zeiger, kein Verschmelzen —
       die Nachrichten koennen in verschiedenen Bereichen liegen.              */
    duplicate_of_id uniqueidentifier     NULL,

    CONSTRAINT pk_rc_topic PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_topic_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_topic_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
CREATE INDEX ix_rc_topic_area ON dbo.rc_topic (area_id, closed_at);
GO

/* 9.3.4: gespeichert wird nur die ID, nicht der Text. Die Suche funktioniert
   dadurch normal, weil die ID unverschluesselt sein kann, ohne Inhalt
   preiszugeben. Fester Katalog im Code, keine eigenen Labels in v1.           */
CREATE TABLE dbo.rc_topic_label (
    topic_id uniqueidentifier NOT NULL,
    label_id smallint         NOT NULL,
    CONSTRAINT pk_rc_topic_label PRIMARY KEY CLUSTERED (topic_id, label_id),
    CONSTRAINT fk_rc_topic_label_topic FOREIGN KEY (topic_id) REFERENCES dbo.rc_topic (id)
);
GO

/* 9.3.1: m:n. Eine Nachricht kann zu mehreren Themen gehoeren, nachtraeglich
   zugeordnet werden, und der ungefilterte Feed bleibt die Gesamtsicht.        */
CREATE TABLE dbo.rc_message_topic (
    message_id  uniqueidentifier  NOT NULL,
    topic_id    uniqueidentifier  NOT NULL,
    assigned_at datetimeoffset(7) NOT NULL,
    assigned_by_role_id uniqueidentifier NOT NULL,
    CONSTRAINT pk_rc_message_topic PRIMARY KEY CLUSTERED (message_id, topic_id),
    CONSTRAINT fk_rc_message_topic_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT fk_rc_message_topic_topic FOREIGN KEY (topic_id) REFERENCES dbo.rc_topic (id)
);
CREATE INDEX ix_rc_message_topic_topic ON dbo.rc_message_topic (topic_id);
GO

/* 9.4: Eigenes Objekt, eigene Sichtbarkeit, GitHub-artige Zustandsmaschine.
   Der Schluessel haengt am Bereich, NIE am Beschluss (E-70) — sonst muessten
   bei einem Mitgliederwechsel Dutzende Beschlussschluessel rotieren.
   Ein angenommener Beschluss schliesst das Thema NICHT (E-69).                */
CREATE TABLE dbo.rc_decision (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    area_id         uniqueidentifier     NOT NULL,
    topic_id        uniqueidentifier     NULL,
    state           nvarchar(16)         NOT NULL,
    body_sealed     varbinary(max)       NOT NULL,   -- 9.4.4: bis 20.000 Zeichen
    ledger_entry_id uniqueidentifier     NOT NULL,   -- immer kettenpflichtig (7.8)
    created_at      datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_decision PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_decision_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_decision_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_decision_state CHECK (state IN
        (N'proposed', N'open', N'accepted', N'rejected', N'reopened'))
);
GO

/* 9.4.2: Bei jedem Uebergang eine verlinkte Begruendung. Kein Uebergang ohne
   Text, volle Historie, jeder Uebergang kettenpflichtig.                      */
CREATE TABLE dbo.rc_decision_transition (
    seq             bigint IDENTITY(1,1) NOT NULL,
    id              uniqueidentifier     NOT NULL,
    decision_id     uniqueidentifier     NOT NULL,
    from_state      nvarchar(16)         NULL,
    to_state        nvarchar(16)         NOT NULL,
    reason_sealed   varbinary(max)       NOT NULL,
    by_role_id      uniqueidentifier     NOT NULL,
    at              datetimeoffset(7)    NOT NULL,
    ledger_entry_id uniqueidentifier     NOT NULL,

    CONSTRAINT pk_rc_decision_transition PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_decision_transition_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_decision_transition_dec FOREIGN KEY (decision_id) REFERENCES dbo.rc_decision (id)
);
GO

/* ---------------------------------------------------------------------------
   Umfragen (9.5)
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_poll (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    area_id          uniqueidentifier     NOT NULL,
    question_sealed  varbinary(max)       NOT NULL,
    mode             nvarchar(16)         NOT NULL,   -- single | multi | quiz
    reveal           nvarchar(16)         NOT NULL,   -- immediate | on_close
    created_at       datetimeoffset(7)    NOT NULL,
    closed_at        datetimeoffset(7)    NULL,

    CONSTRAINT pk_rc_poll PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_poll_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_poll_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id),
    CONSTRAINT ck_rc_poll_mode CHECK (mode IN (N'single', N'multi', N'quiz')),
    CONSTRAINT ck_rc_poll_reveal CHECK (reveal IN (N'immediate', N'on_close'))
);
GO

/* BEFUND 27 — hier weicht die Umsetzung bewusst von Anhang F ab.

   Anhang F: PRIMARY KEY (poll_id, role_id). Damit gibt es je Rolle genau eine
   Zeile, eine geaenderte Stimme ueberschreibt die alte, und 9.5 waere nicht
   einhaltbar.

   Hier: eigener Schluessel plus cast_at. Der Klient zaehlt je Rolle die
   juengste signierte Stimme (E-282) und kann die aelteren zeigen, wie 9.5 es
   verlangt. Der Server kann nicht zaehlen — er sieht die Stimmen nicht.       */
CREATE TABLE dbo.rc_poll_vote (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    poll_id        uniqueidentifier     NOT NULL,
    role_id        uniqueidentifier     NOT NULL,
    choice_sealed  varbinary(1024)      NOT NULL,
    signature      varbinary(1024)      NOT NULL,   -- jede Stimme einzeln signiert
    cast_at        datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_poll_vote PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_poll_vote_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_poll_vote_poll FOREIGN KEY (poll_id) REFERENCES dbo.rc_poll (id)
);
/* 9.5: Die Stimmen werden MIT der Umfrage geladen, nicht einzeln nachgeholt —
   bei sechzig Personen sind das sechzig Datensaetze je Anzeige.               */
CREATE INDEX ix_rc_poll_vote_tally ON dbo.rc_poll_vote (poll_id, role_id, cast_at DESC)
    INCLUDE (choice_sealed, signature);
GO

/* ---------------------------------------------------------------------------
   Lesezustand, Reaktionen, Anhaenge
   --------------------------------------------------------------------------- */

/* 9.9.3: "Gelesen" haengt an der Nachricht und gilt global — wer eine
   Nachricht in einem Thema liest, hat sie auch im ungefilterten Feed gelesen. */
CREATE TABLE dbo.rc_read_state (
    area_id           uniqueidentifier  NOT NULL,
    role_id           uniqueidentifier  NOT NULL,
    last_read_seq     bigint            NOT NULL,
    last_read_at      datetimeoffset(7) NOT NULL,

    /* 9.9.1: je Nutzer abschaltbar, mit Symmetrie — wer verbirgt, sieht auch
       nicht. AUSNAHME: Aufsichtsrollen (4.5). Sonst koennte der
       Aufsichtsfuehrende die Sichtbarkeit abschalten, weiterhin lesen und
       genau das aushebeln, was die Regel zusagt.                              */
    receipts_enabled  bit               NOT NULL CONSTRAINT df_rc_read_receipts DEFAULT 1,
    is_supervisor     bit               NOT NULL CONSTRAINT df_rc_read_sup DEFAULT 0,

    CONSTRAINT pk_rc_read_state PRIMARY KEY CLUSTERED (area_id, role_id),
    /* Aufsicht darf nicht verbergen. */
    CONSTRAINT ck_rc_read_state_sup CHECK (is_supervisor = 0 OR receipts_enabled = 1)
);
GO

/* 9.7: Genau drei. Keine Emoji-Palette — eine psychologische Entscheidung,
   keine technische Vereinfachung. 1 = Zustimmung, 2 = Ablehnung,
   3 = Diskussionsbedarf. Reaktionen sind KEINE Umfrage (E-85).                */
CREATE TABLE dbo.rc_reaction (
    message_id uniqueidentifier  NOT NULL,
    role_id    uniqueidentifier  NOT NULL,
    kind       tinyint           NOT NULL,
    at         datetimeoffset(7) NOT NULL,
    CONSTRAINT pk_rc_reaction PRIMARY KEY CLUSTERED (message_id, role_id),
    CONSTRAINT fk_rc_reaction_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT ck_rc_reaction_kind CHECK (kind IN (1, 2, 3))
);
GO

/* 9.10: Verschluesselt im Dateisystem, in der Datenbank nur der Verweis.
   Kein CDN moeglich — das ist der Preis und er ist bewusst gezahlt (E-93).    */
CREATE TABLE dbo.rc_attachment (
    seq                 bigint IDENTITY(1,1) NOT NULL,
    id                  uniqueidentifier     NOT NULL,
    message_id          uniqueidentifier     NOT NULL,

    /* 15.12: Das Kontingent haengt am KONTO, nicht am Bereich — ein
       Bereichskontingent liesse sich durch Anlegen weiterer Bereiche
       umgehen (E-294).                                                        */
    owner_account_id    uniqueidentifier     NOT NULL,
    size_bytes          bigint               NOT NULL,
    content_sealed_path nvarchar(512)        NOT NULL,
    content_sha256      varbinary(32)        NOT NULL,
    file_name_sealed    varbinary(1024)      NOT NULL,
    created_at          datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_attachment PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_attachment_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_attachment_msg FOREIGN KEY (message_id) REFERENCES dbo.rc_message (id),
    CONSTRAINT fk_rc_attachment_account FOREIGN KEY (owner_account_id) REFERENCES dbo.rc_account (id),
    CONSTRAINT ck_rc_attachment_size CHECK (size_bytes > 0 AND size_bytes <= 10485760)  -- 10 MB (E-94)
);
CREATE INDEX ix_rc_attachment_quota ON dbo.rc_attachment (owner_account_id) INCLUDE (size_bytes);
GO

/* Fassung wird vom Migrationslauf eingetragen, nach Erfolg. */
