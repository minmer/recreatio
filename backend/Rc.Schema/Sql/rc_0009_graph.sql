/* ===========================================================================
   rc_0009_graph — Cogita: der Wissensgraph

   Die Einsicht, auf der alles steht (cogita-graph.md §0): **alles Wissen ist
   ein Graph.** Vokabellisten, Begriffskarten, Zeitleisten, Telefonbuecher —
   alle sind Knoten mit Kanten dazwischen. Die Plattform liefert die Mechanik,
   das Schema bestimmt der Benutzer.

   ---------------------------------------------------------------------------
   DIE SPANNUNG, DIE DIESE FASSUNG AUFLOESEN MUSS.

   §5.2 verlangt: "All indexed fields searched" — Volltextsuche ueber alle
   Felder. Das setzt Klartext voraus. Ein Server kann nicht durchsuchen, was er
   nicht lesen kann; jede Form von durchsuchbarer Verschluesselung verraet
   etwas (Gleichheit, Haeufigkeit, Zugriffsmuster), und wer das verschweigt,
   verkauft Schutz, den es nicht gibt.

   Aufgeloest wird das nicht durch einen Trick, sondern durch eine ENTSCHEIDUNG
   je Bibliothek:

     is_public = 1  Inhalte liegen im Klartext. Der Server durchsucht sie.
                    Fuer Vokabeln, Periodensysteme, Zeitleisten — Wissen, das
                    ohnehin in jedem Lehrbuch steht.

     is_public = 0  Inhalte liegen versiegelt unter dem Epochenschluessel des
                    Bereichs. Der Server sieht Geheimtext. Gesucht wird im
                    BROWSER, ueber das, was der Leser ohnehin geladen hat.

   Die zweite Form skaliert schlechter — das ist der Preis und er steht hier,
   damit ihn niemand spaeter fuer einen Fehler haelt. Eine dritte Form, die
   beides koennte, gibt es nicht.

   ---------------------------------------------------------------------------
   EINE TABELLE FUER ALLE KNOTEN.

   EntityKind, EdgeKind, Range, Text, Zahl, Datum und jede vom Benutzer
   erfundene Art sind ALLE Knoten (§1.2, §1.10). Sie in getrennte Tabellen zu
   legen hiesse, bei jeder neuen Art eine Migration zu schreiben — und der
   ganze Punkt ist, dass der Benutzer neue Arten erfindet, ohne dass jemand
   etwas baut.

   Was in der Datenbank steht, ist deshalb duenn: Kennung, Art, Bibliothek,
   Inhalt. Was eine Art BEDEUTET, steht in einem Knoten derselben Tabelle.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Bibliothek
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_library (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    slug        nvarchar(80)         NOT NULL,
    title       nvarchar(200)        NOT NULL,

    /* Die Entscheidung von oben. Sie faellt beim Anlegen und laesst sich NICHT
       umlegen: aus oeffentlich privat zu machen hiesse, alles nachtraeglich zu
       verschluesseln — und die Klartextfassung waere trotzdem in der Welt.
       Umgekehrt muesste jeder Knoten neu geschrieben werden.                 */
    is_public   bit                  NOT NULL CONSTRAINT df_rc_library_public DEFAULT 0,

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_library PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_library_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_library_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_library_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

CREATE INDEX ix_rc_library_area ON dbo.rc_library (area_id);
GO

/* ---------------------------------------------------------------------------
   Knoten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_node (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    library_id   uniqueidentifier     NOT NULL,

    /* Die ART. IMMER Klartext, auch in einer privaten Bibliothek.
       Sie ist Struktur, kein Inhalt: ohne sie liesse sich der Graph nicht
       einmal zeichnen, und sie verraet nur, DASS es eine Person gibt — nicht,
       wer. Genau dieselbe Ueberlegung wie bei den Teilen einer Veranstaltung.

       Eingebaut sind: text, number, date, boolean, media (§1.1) sowie die
       Systemarten entity_kind, edge_kind, range, knowledge, topic.
       Alles andere ist eine vom Benutzer erfundene Art und steht als Verweis
       auf einen entity_kind-Knoten in kind_node_id.                          */
    kind         nvarchar(40)         NOT NULL,

    /* Bei einer benutzerdefinierten Art: welcher entity_kind sie beschreibt.
       Er ist selbst ein Knoten — dieselbe Tabelle, dieselben Regeln (§1.2).  */
    kind_node_id uniqueidentifier     NULL,

    /* Oeffentliche Bibliothek: Klartext, vom Server durchsuchbar. */
    value        nvarchar(max)        NULL,

    /* Private Bibliothek: versiegelt unter dem Epochenschluessel. */
    value_sealed varbinary(max)       NULL,
    epoch        int                  NULL,

    created_at   datetimeoffset(7)    NOT NULL,
    updated_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_node PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_node_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_node_library FOREIGN KEY (library_id) REFERENCES dbo.rc_library (id),
    CONSTRAINT fk_rc_node_kind FOREIGN KEY (kind_node_id) REFERENCES dbo.rc_node (id),

    /* Entweder Klartext ODER versiegelt — nie beides, nie keines von beiden,
       wenn ueberhaupt ein Wert da ist. Ein Knoten ohne Wert ist erlaubt: eine
       Entitaet ist ein reiner Verbindungspunkt (§1.3).                       */
    CONSTRAINT ck_rc_node_form CHECK (
        (value IS NULL AND value_sealed IS NULL AND epoch IS NULL)
     OR (value IS NOT NULL AND value_sealed IS NULL AND epoch IS NULL)
     OR (value IS NULL AND value_sealed IS NOT NULL AND epoch IS NOT NULL)),

    /* Eine benutzerdefinierte Art verweist auf ihre Beschreibung, eine
       eingebaute nicht. Ohne diese Bedingung entstuende ein `text`-Knoten mit
       einem entity_kind daneben, und niemand wuesste, was gilt.              */
    CONSTRAINT ck_rc_node_kind CHECK (
        (kind = N'entity' AND kind_node_id IS NOT NULL)
     OR (kind <> N'entity' AND kind_node_id IS NULL)),

    CONSTRAINT ck_rc_node_builtin CHECK (kind IN (
        N'text', N'number', N'date', N'boolean', N'media',
        N'entity', N'entity_kind', N'edge_kind', N'range',
        N'knowledge', N'topic', N'question'))
);
GO

CREATE INDEX ix_rc_node_library ON dbo.rc_node (library_id, kind);
GO

/* Die Volltextsuche greift nur bei oeffentlichen Bibliotheken — dort liegt
   der Wert im Klartext. Ein gefilterter Index sagt genau das, und er sagt es
   der Datenbank, nicht nur dem Leser dieser Datei. */
CREATE INDEX ix_rc_node_search ON dbo.rc_node (library_id) WHERE value IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Kanten

   §1.6 — Jede Kante von einer Entitaet zu einem Wert traegt eine Huelle:
   Zustand, Quelle, Notiz. Der Zustand ist der eigentliche Gewinn dieses
   Modells: "unbekannt" und "umstritten" sind ANGABEN, keine fehlenden Daten.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_edge (
    seq            bigint IDENTITY(1,1) NOT NULL,
    id             uniqueidentifier     NOT NULL,
    library_id     uniqueidentifier     NOT NULL,

    from_node_id   uniqueidentifier     NOT NULL,
    to_node_id     uniqueidentifier     NOT NULL,

    /* Die Art der Beziehung. Entweder eingebaut (owner_of, depends_on) oder
       ein Verweis auf einen edge_kind-Knoten (§1.10).                        */
    kind           nvarchar(40)         NOT NULL,
    kind_node_id   uniqueidentifier     NULL,

    /* §1.6 — Der Zustand. `unknown` ist eine Aussage und kein fehlender Wert:
       "wir wissen es nicht" zu sagen ist etwas anderes, als nichts zu sagen. */
    state          nvarchar(16)         NOT NULL CONSTRAINT df_rc_edge_state DEFAULT N'known',

    /* Quelle und Notiz. Die Notiz folgt der Bibliothek: oeffentlich im
       Klartext, privat versiegelt.                                           */
    source_node_id uniqueidentifier     NULL,
    note           nvarchar(max)        NULL,
    note_sealed    varbinary(max)       NULL,
    epoch          int                  NULL,

    /* §1.7 — Mehrwertige Felder: dieselbe Art mehrfach von demselben Knoten.
       Die Reihenfolge ist die der Eingabe und traegt Bedeutung (§1.2: das
       erste Feld ist die Beschriftung).                                      */
    sort_order     int                  NOT NULL CONSTRAINT df_rc_edge_sort DEFAULT 0,

    created_at     datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_edge PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_edge_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_edge_library FOREIGN KEY (library_id) REFERENCES dbo.rc_library (id),
    CONSTRAINT fk_rc_edge_from FOREIGN KEY (from_node_id) REFERENCES dbo.rc_node (id),
    CONSTRAINT fk_rc_edge_to FOREIGN KEY (to_node_id) REFERENCES dbo.rc_node (id),

    CONSTRAINT ck_rc_edge_state CHECK (state IN (
        N'known', N'approximate', N'disputed', N'unknown', N'not_applicable', N'pending')),

    CONSTRAINT ck_rc_edge_note CHECK (
        (note IS NULL AND note_sealed IS NULL AND epoch IS NULL)
     OR (note IS NOT NULL AND note_sealed IS NULL AND epoch IS NULL)
     OR (note IS NULL AND note_sealed IS NOT NULL AND epoch IS NOT NULL)),

    /* Eine Kante von einem Knoten auf sich selbst ist in einem Wissensgraphen
       fast immer ein Fehler beim Verknuepfen — und wenn sie es einmal nicht
       ist, laesst sie sich ueber einen Zwischenknoten ausdruecken.           */
    CONSTRAINT ck_rc_edge_loop CHECK (from_node_id <> to_node_id)
);
GO

CREATE INDEX ix_rc_edge_from ON dbo.rc_edge (from_node_id, kind, sort_order);
CREATE INDEX ix_rc_edge_to ON dbo.rc_edge (to_node_id, kind);
GO

/* ---------------------------------------------------------------------------
   §1.6a — Bereiche (Range)

   Ein Koenig, der 992–1000 und wieder 1002–1025 regierte, hat EINE Regierung
   mit ZWEI Abschnitten. Sie in zwei Kanten zu zerlegen hiesse, zwei
   Regierungen zu behaupten.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_range_segment (
    seq         bigint IDENTITY(1,1) NOT NULL,
    range_node_id uniqueidentifier   NOT NULL,
    sort_order  int                  NOT NULL,

    /* Alle Abschnitte eines Bereichs tragen denselben Grundtyp — sonst liesse
       sich nicht vergleichen, was verglichen werden soll.                    */
    value_type  nvarchar(16)         NOT NULL,

    from_value  nvarchar(200)        NOT NULL,
    to_value    nvarchar(200)        NULL,

    from_state  nvarchar(16)         NOT NULL CONSTRAINT df_rc_seg_from DEFAULT N'inclusive',
    to_state    nvarchar(16)         NOT NULL CONSTRAINT df_rc_seg_to DEFAULT N'inclusive',

    CONSTRAINT pk_rc_range_segment PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_range_segment UNIQUE NONCLUSTERED (range_node_id, sort_order),
    CONSTRAINT fk_rc_range_segment_node FOREIGN KEY (range_node_id) REFERENCES dbo.rc_node (id),
    CONSTRAINT ck_rc_seg_type CHECK (value_type IN (N'date', N'number', N'text')),
    CONSTRAINT ck_rc_seg_from CHECK (from_state IN
        (N'inclusive', N'exclusive', N'approximate', N'unknown')),
    CONSTRAINT ck_rc_seg_to CHECK (to_state IN
        (N'inclusive', N'exclusive', N'approximate', N'open'))
);
GO
