/*
    Die drei Arten einer Rolle, in der Sprache, die hier gesprochen wird:

        person   ein Mensch in der Welt der Schlüssel — das Konto selbst
        role     eine Funktion, die jemand ausübt: Pfarrer, Schriftführerin
        group    die, die dazugehören: Schola, Rada, Ministranten

    Vorher hiessen die beiden letzten `office` und `member`, und das war eine
    Übersetzung aus dem Entwurf statt der Wörter, die im Haus benutzt werden.
    „Mitgliedschaft" ist ausserdem die Beziehung und nicht die Sache: was eine
    Rolle beschreibt, ist die GRUPPE, nicht das Dazugehören.

    <b>Struktur bleibt.</b> Eine Gruppe ist weiterhin eine Rolle, die mehrere
    halten; eine Funktion eine, die übergeben wird, ohne ein Konto
    weiterzureichen. Es ändert sich das Etikett, nicht das Modell — deshalb
    genügt hier ein UPDATE und keine Wanderung von Zeilen.

    Die Reihenfolge ist Absicht: erst die Prüfung fort, dann die Werte, dann die
    neue Prüfung. Andersherum lehnte die alte Prüfung genau die Werte ab, die
    gesetzt werden sollen.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_role_kind')
    ALTER TABLE app.role DROP CONSTRAINT ck_role_kind;
GO

UPDATE app.role SET kind = N'role'  WHERE kind = N'office';
UPDATE app.role SET kind = N'group' WHERE kind = N'member';
GO

ALTER TABLE app.role ADD CONSTRAINT ck_role_kind
    CHECK (kind IN (N'person', N'role', N'group'));
GO
