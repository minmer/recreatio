/*
    Was an einer Kante UNTERSCHRIEBEN wird, muss auch in der Zeile stehen.

    Der Kernel unterschreibt eine Kante über ihre kanonische Form
    (`RoleEdgeRecord.ToCanonicalValue`), und dort stehen `edgeKind` und
    `expiresAt` mit drin. In der Tabelle standen sie nicht. Solange beide Seiten
    dieselben festen Werte einsetzen, geht das gut — bis zum ersten Tag, an dem
    eine Kante ablaufen soll oder eine zweite Art bekommt. Dann ist die
    Unterschrift über etwas gebildet, das die Zeile nicht mehr hergibt, und
    nachprüfen kann sie niemand mehr.

    Eine Unterschrift, deren Inhalt sich nicht aus der Zeile rekonstruieren
    lässt, ist keine Unterschrift, sondern ein Byte-Feld.

    <b>`holds` als Vorgabe</b>, weil das die einzige Art ist, die der Neubau
    heute vergibt. `inherits` und `supervises` stehen in der Prüfliste, damit
    die Zeile nicht erst wandern muss, wenn ein Modul sie braucht — der Kernel
    deutet keine davon (3.1), das tut das Modul.
*/

IF COL_LENGTH('app.role_edge', 'edge_kind') IS NULL
    ALTER TABLE app.role_edge ADD edge_kind nvarchar(16) NOT NULL
        CONSTRAINT df_role_edge_kind DEFAULT (N'holds');
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_role_edge_kind')
    ALTER TABLE app.role_edge ADD CONSTRAINT ck_role_edge_kind
        CHECK (edge_kind IN (N'holds', N'inherits', N'supervises'));
GO

/*
    Ein Ablauf ist die Ausnahme, nicht die Regel: NULL heisst „gilt, bis sie
    zurückgenommen wird". Wer eine Kante auf Zeit gibt, schreibt hier einen
    Zeitpunkt hinein — und genau der geht dann in die Unterschrift ein.
*/
IF COL_LENGTH('app.role_edge', 'expires_at') IS NULL
    ALTER TABLE app.role_edge ADD expires_at datetimeoffset NULL;
GO
