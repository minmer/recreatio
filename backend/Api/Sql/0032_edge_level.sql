/*
    Drei Arten, eine Rolle weiterzugeben — statt einer.

    =========================================================================
    WOHER DIE DREI KOMMEN
    =========================================================================

    Der Altbestand kannte sie und zeichnete sie als drei Punkte an jedem Knoten
    (`roleGraphConfig.ts`):

        Owner   #1d4ed8   fuehrt die Rolle: aendern, weitergeben, aufnehmen
        Write   #dc2626   darf eintragen, was der Rolle gehoert
        Read    #0284c7   darf hineinsehen

    `Domain/RoleRelationships.cs` nannte die Ordnung: Owner schliesst Write
    ein, Write schliesst Read ein, und `AdminOf` war ein zweiter Name fuer
    Owner.

    =========================================================================
    WARUM `holds` BLEIBT UND NICHT `owner` HEISST
    =========================================================================

    0008 legte `edge_kind` an, mit `holds | inherits | supervises`, und der
    Neubau vergibt bis heute genau `holds`. Eine Kante `holds` sagt: diese
    Rolle HAELT jene — sie hat deren Schluessel und kann in ihrem Namen
    handeln. Das ist Wort fuer Wort das, was der Altbestand `Owner` nannte.

    Ein zusaetzliches `owner` daneben waere dieselbe Sache unter zwei Namen,
    und zwei Namen fuer eine Sache laufen auseinander. Die vorhandenen Kanten
    bleiben deshalb unangetastet; die Oberflaeche beschriftet `holds` als
    „Owner".

    =========================================================================
    WAS DIE UNTERSCHRIFT ANGEHT
    =========================================================================

    `edge_kind` steht seit 0008 in der Zeile UND in der kanonischen Form, ueber
    die der Kernel unterschreibt (`RoleEdgeRecord.ToCanonicalValue`). Der
    Browser setzte dort bisher die Zeichenkette `holds` fest ein. Er setzt ab
    jetzt die gewaehlte Art ein — dieselbe, die in der Zeile landet.

    Das ist der ganze Grund, warum 0008 die Spalte ueberhaupt angelegt hat:

        „Eine Unterschrift, deren Inhalt sich nicht aus der Zeile
        rekonstruieren laesst, ist keine Unterschrift, sondern ein Byte-Feld."

    Waere die Art nur im Browser bekannt, liesse sich eine `read`-Kante nicht
    von einer `holds`-Kante unterscheiden, sobald jemand die Zeile nachprueft.

    =========================================================================
    WAS DIESE MIGRATION NICHT TUT
    =========================================================================

    Sie sagt NICHT, was die drei Arten kryptografisch bedeuten. Heute oeffnet
    EIN Rollenschluessel alles einer Rolle — Name, Verpackungs- und
    Signierschluessel zugleich —, und deshalb kann eine Zuteilung derzeit nicht
    weniger hergeben als alles. Ob `read` und `write` bloss Hausregeln sind
    oder mit eigenem Schluesselmaterial durchgesetzt werden, entscheidet die
    naechste Migration; hier steht erst einmal, dass die Zeile die Art tragen
    darf.

    Wer das liest und die Oberflaeche sieht: solange keine solche Migration
    folgt, darf die Oberflaeche `read` und `write` nicht als Schranke
    ausgeben, die sie nicht sind.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_role_edge_kind')
    ALTER TABLE app.role_edge DROP CONSTRAINT ck_role_edge_kind;
GO

ALTER TABLE app.role_edge ADD CONSTRAINT ck_role_edge_kind
    CHECK (edge_kind IN (N'holds', N'inherits', N'supervises', N'write', N'read'));
GO

/*
    ZWEI KANTEN DERSELBEN ART zwischen denselben Rollen sind keine zwei
    Beziehungen, sondern eine doppelt eingetragene. Zwei VERSCHIEDENER Art sind
    dagegen sinnvoll — wer eine Rolle haelt, kann daneben eine Lesekante von
    woanders haben, und welche zaehlt, entscheidet die Aufloesung.

    Gefiltert auf die offenen: eine zurueckgenommene Kante darf derselben
    Paarung nicht im Weg stehen, wenn sie spaeter neu entsteht.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uq_role_edge_live')
    CREATE UNIQUE INDEX uq_role_edge_live
        ON app.role_edge (from_role_id, to_role_id, edge_kind)
        WHERE revoked_at IS NULL;
GO
