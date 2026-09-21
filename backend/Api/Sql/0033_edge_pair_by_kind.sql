/*
    Die alte Eindeutigkeit kannte die Art noch nicht.

    =========================================================================
    DER BEFUND
    =========================================================================

    0001 legte an:

        ux_role_edge_pair  (from_role_id, to_role_id)  WHERE revoked_at IS NULL

    Das war richtig, solange es genau eine Art von Kante gab: „dieselbe
    Paarung" und „dieselbe Zusage" waren dasselbe.

    Seit 0032 sind sie es nicht mehr. Eine Rolle kann eine andere FUEHREN und
    eine dritte darf in sie HINEINSEHEN — und beides zwischen denselben zwei
    Rollen ist kein Widerspruch, sondern der Normalfall, sobald jemand eine
    Stufe erhoeht, ohne die alte zu loesen.

    0032 hat die richtige Eindeutigkeit daneben gestellt:

        uq_role_edge_live  (from_role_id, to_role_id, edge_kind)  WHERE revoked_at IS NULL

    Beide zugleich heisst: die alte gewinnt immer, und die neue steht nur
    daneben und tut nichts. Eine zweite Art zwischen denselben Rollen scheitert
    dann an einer Bedingung, die niemand mehr gemeint hat — als 500, denn
    geplant war sie nicht.

    =========================================================================
    WAS BLEIBT
    =========================================================================

    Dieselbe Art zweimal bleibt verboten; das besorgt jetzt `uq_role_edge_live`.
    Verschiedene Arten nebeneinander sind erlaubt, und welche zaehlt,
    entscheidet die Aufloesung — nicht der Index.
*/

IF EXISTS (SELECT 1 FROM sys.indexes
           WHERE name = 'ux_role_edge_pair' AND object_id = OBJECT_ID('app.role_edge'))
    DROP INDEX ux_role_edge_pair ON app.role_edge;
GO

/*
    Sicherheitshalber: 0032 hat sie angelegt, aber wer diese Datei auf einer
    Datenbank laufen laesst, auf der 0032 aus irgendeinem Grund nur halb
    durchlief, soll nicht ohne JEDE Eindeutigkeit dastehen.
*/
IF NOT EXISTS (SELECT 1 FROM sys.indexes
               WHERE name = 'uq_role_edge_live' AND object_id = OBJECT_ID('app.role_edge'))
    CREATE UNIQUE INDEX uq_role_edge_live
        ON app.role_edge (from_role_id, to_role_id, edge_kind)
        WHERE revoked_at IS NULL;
GO
