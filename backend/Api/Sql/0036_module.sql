/*
    Ein Baustein ist ein DING, kein Platz auf einer Seite.

    =========================================================================
    DER BEFUND
    =========================================================================

    `app.slug_part` traegt beides in einer Zeile:

        slug_id, position, layout     WO er steht
        kind, config                  WAS er ist

    Solange jeder Baustein genau einmal vorkam, war das dasselbe. Es ist es
    nicht mehr, sobald jemand denselben Bogen auf zwei Seiten haengen will —
    den Anmeldebogen auf der Startseite und noch einmal unter `zapisy`. Heute
    entstuenden zwei Bausteine, und damit zwei getrennte Saetze von Fragen und
    zwei getrennte Saetze von Antworten. Dass sie gleich AUSSEHEN, macht sie
    nicht zu einem.

    Und es fehlt die Angabe, die ueber alles andere entscheidet: in welchen
    BEREICH ein Baustein gehoert. Seine Felder wissen es je Feld
    (`slug_field.area_id`, seit 0022), der Baustein selbst wusste es nie.

    =========================================================================
    ZWEI TABELLEN STATT EINER
    =========================================================================

        app.module      der Baustein: Bereich, Art, Name, Einstellung
        app.slug_part   seine VERWENDUNG auf einer Seite: wo, wie breit

    Damit ist „derselbe Baustein an zwei Stellen" kein Sonderfall mehr,
    sondern zwei Zeilen in `slug_part`, die auf dieselbe Zeile in `module`
    zeigen. Die Daten haengen am Baustein; die Seite zeigt ihn nur.

    =========================================================================
    WARUM DER BEREICH FEHLEN DARF
    =========================================================================

    `area_id` ist NULL erlaubt, und das ist keine Bequemlichkeit.

    Ein Textbaustein traegt nichts Versiegeltes — sein Inhalt steht offen in
    `config`, weil er auf einem oeffentlichen Aushang steht. Ihn zu zwingen,
    einen Bereich zu nennen, hiesse einen Schluessel zu verlangen, den er nicht
    benutzt.

    Und fuer die BESTEHENDEN Bausteine liesse sich keiner erraten. Ein Bogen
    verraet ihn (seine Felder nennen ihn); ein Messplan und ein Text nicht.
    Etwas zu erfinden waere schlimmer als die Luecke: es stuende danach eine
    Zuordnung da, die niemand getroffen hat. Die Oberflaeche fragt stattdessen
    nach, wo sie fehlt.

    =========================================================================
    ES WIRD NICHTS GELOESCHT
    =========================================================================

    `slug_part.kind` und `config` bleiben vorerst stehen und werden weiter
    gefuehrt. Erst wenn jede lesende Stelle ueber `module` geht, faellt die
    Dopplung — und dann in einer eigenen Migration, die nichts anderes tut.
*/

IF OBJECT_ID('app.module', 'U') IS NULL
BEGIN
    CREATE TABLE app.module
    (
        id         uniqueidentifier NOT NULL,

        /*
            WOHIN SEINE DATEN GEHOEREN. NULL heisst: er hat keine — ein Text
            steht offen. Siehe oben; das ist eine Aussage und keine Luecke.
        */
        area_id    uniqueidentifier NULL,

        /* Dieselben Arten wie bisher in `slug_part.kind`. */
        kind       nvarchar(32)     NOT NULL,

        /*
            Der Name, unter dem man ihn WIEDERFINDET. Klartext: er steht in
            einer Auswahlliste, bevor jemand einen Schluessel hat — wie der
            Name eines Bereichs (0019), und aus demselben Grund.
        */
        name       nvarchar(200)    NOT NULL,

        /* Undurchsichtiges JSON, wie bisher. */
        config     nvarchar(max)    NULL,

        created_at datetimeoffset   NOT NULL,

        CONSTRAINT pk_module PRIMARY KEY (id),
        CONSTRAINT fk_module_area FOREIGN KEY (area_id) REFERENCES app.area (id)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_module_area')
    CREATE INDEX ix_module_area ON app.module (area_id) WHERE area_id IS NOT NULL;
GO

/* -- Die Verwendung ------------------------------------------------------- */

IF NOT EXISTS (SELECT 1 FROM sys.columns
               WHERE object_id = OBJECT_ID('app.slug_part') AND name = 'module_id')
BEGIN
    ALTER TABLE app.slug_part ADD module_id uniqueidentifier NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_part_module')
    ALTER TABLE app.slug_part ADD CONSTRAINT fk_slug_part_module
        FOREIGN KEY (module_id) REFERENCES app.module (id);
GO

/* -- Was schon dasteht, bekommt seinen Baustein --------------------------- */

/*
    Je vorhandener Zeile genau einer, mit derselben Kennung. Dieselbe Kennung
    ist kein Zufall: `slug_field.part_id` und `registration.part_id` zeigen
    heute auf `slug_part.id`, und solange der Baustein dieselbe traegt, zeigen
    sie damit auch auf ihn. Das erspart ein Umhaengen von 39 Einsendungen und
    234 Werten — und ein Umhaengen, das nicht stattfindet, kann auch nichts
    verlieren.
*/
INSERT INTO app.module (id, area_id, kind, name, config, created_at)
SELECT p.id,

       /*
           Der Bereich, WENN er sich aus den Feldern ergibt. Ein Bogen, dessen
           Felder alle in einem Bereich liegen, nennt ihn damit eindeutig.
           Liegen sie in mehreren, ist die Frage offen — dann NULL, und die
           Kanzlei entscheidet.
       */
       CASE WHEN (SELECT COUNT(DISTINCT f.area_id) FROM app.slug_field f
                   WHERE f.part_id = p.id) = 1
            THEN (SELECT TOP 1 f.area_id FROM app.slug_field f WHERE f.part_id = p.id)
            ELSE NULL END,

       p.kind,

       /* Ein Name, unter dem er wiederzufinden ist. Die Art plus die Adresse,
          auf der er heute steht — mehr ist aus der Zeile nicht zu holen. */
       LEFT(p.kind + N' — ' + s.path, 200),

       p.config,
       p.created_at
FROM app.slug_part p
JOIN app.slug s ON s.id = p.slug_id
WHERE NOT EXISTS (SELECT 1 FROM app.module m WHERE m.id = p.id);
GO

UPDATE app.slug_part
   SET module_id = id
 WHERE module_id IS NULL;
GO

/* „Welche Seiten zeigen diesen Baustein" — die Frage jeder Verwendung. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_slug_part_module')
    CREATE INDEX ix_slug_part_module ON app.slug_part (module_id) WHERE module_id IS NOT NULL;
GO
