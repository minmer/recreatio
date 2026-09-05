/*
    Zwei Arten von Intentionen — und die Uhrzeit, die aus einem Tag wird.

    -------------------------------------------------------------------------
    1. EINZELN ODER ZUSAMMENGELEGT
    -------------------------------------------------------------------------

    Eine Messe kann mehrere Intentionen tragen, aber nicht auf zweierlei Weise
    zugleich:

      EINZELN (single) — mehrere Intentionen, aber dann hat JEDER PRIESTER
      seine eigene. Zwei einzelne Intentionen in einer Messe heissen also:
      zwei Priester konzelebrieren, jeder mit seiner.

      ZUSAMMENGELEGT (collective) — EIN Priester liest mehrere Intentionen in
      derselben Messe zusammen.

    Der Unterschied ist keine Beschriftung. Er entscheidet, wie viele Priester
    gebraucht werden, und er ist kirchenrechtlich der Grund, warum es die
    zweite Form ueberhaupt gesondert gibt. Eine Oberflaeche, die beides als
    „mehrere Intentionen" fuehrt, kann die Frage „brauche ich noch jemanden"
    nicht mehr beantworten.

    Daher zwei Spalten: die Art, und WER sie liest. Und eine Regel, die die
    Datenbank haelt: zwei EINZELNE Intentionen derselben Messe duerfen nicht
    denselben Priester nennen — sonst waere es keine zweite Intention, sondern
    dieselbe Messe zweimal gezaehlt.

    Fuer zusammengelegte gilt die Regel NICHT: dort ist es gerade der Punkt,
    dass ein Priester viele traegt.

    -------------------------------------------------------------------------
    2. EIN TAG IST EINE UHRZEIT
    -------------------------------------------------------------------------

    Die Belegung eines Hauses lief bisher in ganzen Tagen, die Messe in
    Uhrzeiten — und beides liess sich nicht zusammenrechnen.

    Das war ein Scheinunterschied. „Der 5. bis der 8." heisst in einem
    Gaestehaus: ab dem 5. um 18 Uhr bis zum 8. um 18 Uhr. Ein Tag IST eine
    Uhrzeit, nur mit einer stillschweigenden Vereinbarung darueber, wann er
    beginnt. Steht die Vereinbarung ausdruecklich da, ist der Unterschied weg.

    Und er war nicht bloss unschoen: die Pruefung auf Zusammenstoesse lautete
    `from_date <= @to AND to_date >= @from` — an beiden Enden einschliessend.
    Wer am 5. um 18 Uhr abreist, blockierte damit den, der am 5. um 18 Uhr
    anreist. Eine gueltige Buchung wurde abgewiesen, und niemand konnte sehen,
    warum.
*/

/* -------------------------------------------------------------------------
   Die Art der Intention und ihr Priester
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_mass_intention', 'kind') IS NULL
BEGIN
    ALTER TABLE dbo.rc_mass_intention ADD kind nvarchar(20) NOT NULL
        CONSTRAINT df_rc_mass_intention_kind DEFAULT (N'single');
END
GO

IF COL_LENGTH('dbo.rc_mass_intention', 'celebrant_role_id') IS NULL
BEGIN
    /*
        NULL heisst: noch nicht zugeteilt. Das ist ein echter Zustand und kein
        fehlender Wert — eine Intention wird angenommen, lange bevor feststeht,
        wer sie liest.
    */
    ALTER TABLE dbo.rc_mass_intention ADD celebrant_role_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_mass_intention_kind')
BEGIN
    ALTER TABLE dbo.rc_mass_intention ADD CONSTRAINT ck_rc_mass_intention_kind
        CHECK (kind IN (N'single', N'collective'));
END
GO

/*
    Zwei EINZELNE Intentionen derselben Messe mit demselben Priester gibt es
    nicht. Zurueckgezogene zaehlen nicht mit, und ein noch nicht zugeteilter
    Priester auch nicht — sonst liesse sich nur eine einzige Intention ohne
    Zuteilung anlegen.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_rc_mass_intention_celebrant')
BEGIN
    CREATE UNIQUE INDEX uq_rc_mass_intention_celebrant
        ON dbo.rc_mass_intention (item_id, occurrence_at, celebrant_role_id)
        WHERE kind = N'single'
          AND celebrant_role_id IS NOT NULL
          AND status <> N'cancelled';
END
GO

/* -------------------------------------------------------------------------
   Die Stunde, zu der ein Tag wechselt
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_resource', 'changeover_hour') IS NULL
BEGIN
    /*
        18 Uhr, weil das die Stunde ist, zu der ein Gaestehaus wechselt: die
        einen sind fort, die anderen kommen zum Abendessen. Wer eine andere
        Ordnung hat, traegt sie ein.
    */
    ALTER TABLE dbo.rc_resource ADD changeover_hour tinyint NOT NULL
        CONSTRAINT df_rc_resource_changeover DEFAULT (18);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_resource_changeover')
BEGIN
    ALTER TABLE dbo.rc_resource ADD CONSTRAINT ck_rc_resource_changeover
        CHECK (changeover_hour BETWEEN 0 AND 23);
END
GO

/* -------------------------------------------------------------------------
   Belegungen bekommen Uhrzeiten
   ------------------------------------------------------------------------- */

IF COL_LENGTH('dbo.rc_resource_hold', 'from_at') IS NULL
BEGIN
    ALTER TABLE dbo.rc_resource_hold ADD
        from_at datetimeoffset(7) NULL,
        to_at   datetimeoffset(7) NULL;
END
GO

/*
    Die alten Tagesangaben in Uhrzeiten uebersetzen.

    +02:00, weil diese Haeuser in Polen stehen — dieselbe Begruendung wie die
    Vorgabe der Zeitzone im Messplan. Es ist kein Raten: laege eines anderswo,
    trueg es eine eigene Zone, und diese Zeile fasste es nicht an.

    Die Tagesspalten bleiben stehen. Eine angewendete Migration wird nicht
    bearbeitet, sondern ergaenzt — und solange beide dastehen, laesst sich
    nachsehen, was hier woraus wurde.
*/
UPDATE h
SET from_at = TODATETIMEOFFSET(
        DATEADD(hour, r.changeover_hour, CAST(h.from_date AS datetime2(7))), '+02:00'),
    to_at = TODATETIMEOFFSET(
        DATEADD(hour, r.changeover_hour, CAST(h.to_date AS datetime2(7))), '+02:00')
FROM dbo.rc_resource_hold h
JOIN dbo.rc_resource r ON r.id = h.resource_id
WHERE h.from_at IS NULL;
GO

/*
    Jetzt duerfen sie nicht mehr fehlen. Eine Belegung ohne Zeitraum ist keine
    Belegung, sondern eine Zeile, die jede Pruefung auf Zusammenstoesse still
    durchlaesst.
*/
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('dbo.rc_resource_hold')
             AND name = 'from_at' AND is_nullable = 1)
BEGIN
    ALTER TABLE dbo.rc_resource_hold ALTER COLUMN from_at datetimeoffset(7) NOT NULL;
    ALTER TABLE dbo.rc_resource_hold ALTER COLUMN to_at datetimeoffset(7) NOT NULL;
END
GO

/*
    Ein Zeitraum, der endet, bevor er beginnt, ist keiner. Gleichheit ebenso
    wenig: eine Belegung von 18 Uhr bis 18 Uhr desselben Tages belegt nichts
    und blockiert trotzdem die Pruefung.
*/
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_rc_resource_hold_span')
BEGIN
    ALTER TABLE dbo.rc_resource_hold ADD CONSTRAINT ck_rc_resource_hold_span
        CHECK (to_at > from_at);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_rc_resource_hold_at')
BEGIN
    CREATE INDEX ix_rc_resource_hold_at
        ON dbo.rc_resource_hold (resource_id, from_at, to_at);
END
GO
