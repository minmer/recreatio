/*
    Fragen und Antworten haengen am BAUSTEIN, nicht an seiner Verwendung.

    Seit 0036 ist ein Baustein ein Ding fuer sich (`app.module`) und seine
    Stellen auf Seiten sind Verwendungen (`app.slug_part`). Die Spalte
    `part_id` in `slug_field` und `registration` meint seitdem den Baustein —
    der Browser schickt seine Kennung, und 0036 gab jedem alten Baustein
    dieselbe Kennung wie seiner Verwendung, damit nichts umgehaengt werden
    musste.

    Die FREMDSCHLUESSEL zeigten aber weiter auf `slug_part`. Solange Baustein
    und Verwendung dieselbe Kennung trugen, fiel das nicht auf. Ein Formular
    aus der Bausteinliste hat eine eigene Kennung und steht womoeglich auf
    keiner Seite — seine erste Frage scheiterte an `fk_slug_field_part`, und
    die Bearbeitung sagte „Takiego bloku nie ma".

    Und in der Gegenrichtung: eine Verwendung liess sich nicht von einer Seite
    nehmen, solange Fragen an ihr hingen — die Seite loeschte deshalb die
    Fragen mit, also die des Bausteins, der in der Liste stehenbleibt.

    Vorher geprueft (2026-09-24): jede `part_id` in beiden Tabellen ist die
    Kennung eines vorhandenen Bausteins, keine zeigt auf die Verwendung eines
    ANDEREN. Es wird nichts umgehaengt; nur die Schluessel zeigen woandershin.
*/

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_field_part')
    ALTER TABLE app.slug_field DROP CONSTRAINT fk_slug_field_part;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_slug_field_module')
    ALTER TABLE app.slug_field ADD CONSTRAINT fk_slug_field_module
        FOREIGN KEY (part_id) REFERENCES app.module (id);
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_registration_part')
    ALTER TABLE app.registration DROP CONSTRAINT fk_registration_part;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_registration_module')
    ALTER TABLE app.registration ADD CONSTRAINT fk_registration_module
        FOREIGN KEY (part_id) REFERENCES app.module (id);
GO
