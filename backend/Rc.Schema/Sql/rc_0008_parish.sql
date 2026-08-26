/* ===========================================================================
   rc_0008_parish — Pfarrei: Messen, Intentionen, Gaben

   Dieselbe Bauweise wie bei den Veranstaltungen, und aus denselben Gruenden:

     * Eine Pfarrei haengt an einem BEREICH. Von dort kommen Schluessel,
       Mitglieder, Zertifikate und Kette. Kein zweites Epochenmodell.

     * Was oeffentlich ist, liegt im Klartext. Der Messplan haengt am
       Schaukasten — ihn zu verschluesseln und den Schluessel mitzuliefern
       waere Theater.

   ---------------------------------------------------------------------------
   DIE INTENTION IST DER INTERESSANTE FALL, und der Altbestand hatte ihn
   bereits richtig (siehe _reference/backend/parish/Data/ParishIntention.cs):
   EINE Zeile traegt beides.

     public_text        — was im Plan steht: "in einer bestimmten Absicht"
     internal_sealed    — was wirklich gemeint ist
     donor_ref_sealed   — von wem

   Das ist kein Zufall, sondern der Alltag: eine Intention wird oeffentlich
   angekuendigt, aber wofuer und von wem sie gestiftet wurde, geht die Gemeinde
   nichts an. Bei den Veranstaltungen trennt die Sichtbarkeit ganze Abschnitte,
   hier trennt sie FELDER derselben Zeile.

   Deshalb steht hier auch keine ck-Bedingung "entweder oder": beides gehoert
   zusammen und ist gleichzeitig gueltig.

   ---------------------------------------------------------------------------
   GABEN sind Geld. 12.9 — die Klasse steht fest und nicht zur Wahl: ein Betrag
   mit Namen daneben ist ueberall eine besondere Kategorie. Er liegt deshalb
   IMMER versiegelt, auch wenn jemand meint, das sei uebertrieben.
   =========================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

/* ---------------------------------------------------------------------------
   Die Pfarrei
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_parish (
    seq         bigint IDENTITY(1,1) NOT NULL,
    id          uniqueidentifier     NOT NULL,

    /* Woher Schluessel, Mitglieder, Zertifikate und Kette kommen. */
    area_id     uniqueidentifier     NOT NULL,
    tenant_id   uniqueidentifier     NOT NULL,

    slug        nvarchar(80)         NOT NULL,
    name        nvarchar(200)        NOT NULL,
    location    nvarchar(200)        NULL,

    created_at  datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_parish PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_parish_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT uq_rc_parish_slug UNIQUE NONCLUSTERED (tenant_id, slug),
    CONSTRAINT fk_rc_parish_area FOREIGN KEY (area_id) REFERENCES dbo.rc_area (id)
);
GO

/* Ein Bereich traegt hoechstens eine Pfarrei — dieselbe Ueberlegung wie bei
   den Veranstaltungen: zwei waeren zwei Oeffentlichkeiten hinter demselben
   Schluessel. */
CREATE UNIQUE INDEX uq_rc_parish_area ON dbo.rc_parish (area_id);
GO

/* ---------------------------------------------------------------------------
   Messen — der Plan. Oeffentlich, im Klartext.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_mass (
    seq          bigint IDENTITY(1,1) NOT NULL,
    id           uniqueidentifier     NOT NULL,
    parish_id    uniqueidentifier     NOT NULL,

    starts_at    datetimeoffset(7)    NOT NULL,
    church       nvarchar(128)        NOT NULL,
    title        nvarchar(256)        NULL,
    note         nvarchar(512)        NULL,

    /* Eine Sammelmesse traegt mehrere Intentionen. Der Unterschied ist nicht
       kosmetisch: bei einer Einzelmesse gehoert die Intention dieser Messe,
       bei einer Sammelmesse teilen sich mehrere den Termin.                  */
    is_collective bit                 NOT NULL CONSTRAINT df_rc_mass_coll DEFAULT 0,

    duration_min int                  NULL,
    kind         nvarchar(80)         NULL,

    created_at   datetimeoffset(7)    NOT NULL,
    updated_at   datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_mass PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_mass_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_mass_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT ck_rc_mass_duration CHECK (duration_min IS NULL OR duration_min BETWEEN 1 AND 600)
);
GO

CREATE INDEX ix_rc_mass_when ON dbo.rc_mass (parish_id, starts_at);
GO

/* ---------------------------------------------------------------------------
   Intentionen — EINE Zeile, zwei Sichtbarkeiten
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_intention (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    parish_id        uniqueidentifier     NOT NULL,

    /* NULL heisst: noch keinem Termin zugeordnet. Das ist der Normalfall am
       Anfang — jemand stiftet eine Intention, der Termin kommt spaeter.      */
    mass_id          uniqueidentifier     NULL,

    /* Unter welcher Epoche des Bereichs die versiegelten Felder liegen. */
    epoch            int                  NOT NULL,

    /* Was im Plan steht. Klartext, oeffentlich — dafuer ist es da.           */
    public_text      nvarchar(512)        NOT NULL,

    /* Was wirklich gemeint ist, und von wem. Versiegelt unter dem
       Epochenschluessel des Bereichs. NULL ist erlaubt: nicht jede Intention
       hat einen internen Text, und nicht jede einen genannten Stifter.       */
    internal_sealed  varbinary(max)       NULL,
    donor_ref_sealed varbinary(max)       NULL,

    /* active | fulfilled | cancelled */
    status           nvarchar(16)         NOT NULL CONSTRAINT df_rc_intention_status DEFAULT N'active',

    created_at       datetimeoffset(7)    NOT NULL,
    updated_at       datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_intention PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_intention_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_intention_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_intention_mass FOREIGN KEY (mass_id) REFERENCES dbo.rc_mass (id),
    CONSTRAINT ck_rc_intention_status CHECK (status IN (N'active', N'fulfilled', N'cancelled'))
);
GO

CREATE INDEX ix_rc_intention_mass ON dbo.rc_intention (mass_id) WHERE mass_id IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Gaben — Geld

   12.9: die Klasse steht FEST. Ein Betrag mit einem Namen daneben ist ueberall
   eine besondere Kategorie, und es gibt keinen Schalter, der das aufweicht.
   Der Betrag liegt deshalb versiegelt — nicht als Zahl, ueber die sich
   summieren liesse, sondern als Geheimtext.

   Das kostet etwas: eine Summe ueber alle Gaben laesst sich nicht in SQL
   bilden. Das ist der Preis und er ist bekannt — wer summieren will, holt die
   Zeilen und rechnet mit dem Schluessel in der Hand.
   --------------------------------------------------------------------------- */

CREATE TABLE dbo.rc_offering (
    seq              bigint IDENTITY(1,1) NOT NULL,
    id               uniqueidentifier     NOT NULL,
    parish_id        uniqueidentifier     NOT NULL,
    intention_id     uniqueidentifier     NULL,

    epoch            int                  NOT NULL,

    amount_sealed    varbinary(max)       NOT NULL,

    /* Die Waehrung bleibt Klartext: sie ist keine Auskunft ueber die Person,
       und ohne sie liesse sich ein Betrag nicht einmal darstellen.           */
    currency         nvarchar(3)          NOT NULL CONSTRAINT df_rc_offering_ccy DEFAULT N'PLN',

    donor_ref_sealed varbinary(max)       NULL,
    received_on      date                 NOT NULL,

    created_at       datetimeoffset(7)    NOT NULL,

    CONSTRAINT pk_rc_offering PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT uq_rc_offering_id UNIQUE NONCLUSTERED (id),
    CONSTRAINT fk_rc_offering_parish FOREIGN KEY (parish_id) REFERENCES dbo.rc_parish (id),
    CONSTRAINT fk_rc_offering_intention FOREIGN KEY (intention_id) REFERENCES dbo.rc_intention (id),

    /* ISO-4217 hat drei Buchstaben. Eine Waehrung, die anders aussieht, ist
       ein Tippfehler — und ein Tippfehler in einer Waehrung bedeutet, dass
       zwei Betraege spaeter nicht mehr vergleichbar sind.                    */
    CONSTRAINT ck_rc_offering_ccy CHECK (currency LIKE N'[A-Z][A-Z][A-Z]')
);
GO

CREATE INDEX ix_rc_offering_intention ON dbo.rc_offering (intention_id) WHERE intention_id IS NOT NULL;
GO

/* ---------------------------------------------------------------------------
   Anfuegend, nicht ueberschreibend

   Gaben werden nicht geloescht. Wer eine Buchung zuruecknehmen will, bucht
   dagegen — das ist die Regel in jeder Kasse, und sie steht hier in der
   Datenbank statt in einer Handreichung.
   --------------------------------------------------------------------------- */

CREATE TRIGGER dbo.tr_rc_offering_append
ON dbo.rc_offering
INSTEAD OF DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    THROW 50006, N'rc_offering ist anfuegend: eine Buchung wird gegengebucht, nicht geaendert.', 1;
END;
GO
