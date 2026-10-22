/*
    0122 — EIN EINTRAG ZIEHT IN DIE BIBLIOTHEK EINES ANDEREN BEREICHS.

    Seit 2026-10-22 entscheidet über die Sichtbarkeit eines Bibliothekseintrags
    allein sein Bereich (Library.Areas.cs). Wer einen Eintrag öffentlich will,
    trägt ihn in die Bibliothek eines öffentlichen Bereichs — die Kennung
    bleibt, damit alle Verweise weiter auf ihn zeigen.

    Die alte Bibliothek muss beim nächsten Abgleich (`since`) erfahren, dass er
    fort ist. Ein Grabstein mit derselben Kennung geht nicht — die Zeile gehört
    jetzt der anderen Bibliothek. Darum diese Spur: wer wann aus welcher
    Bibliothek ging. Der Abgleich der alten Bibliothek meldet ihn als gelöscht.

    Idempotent; keine Daten werden verändert.
*/

IF OBJECT_ID('app.library_moved', 'U') IS NULL
    CREATE TABLE app.library_moved
    (
        entry_id         uniqueidentifier NOT NULL,
        from_library_id  uniqueidentifier NOT NULL,
        moved_at         datetimeoffset   NOT NULL,

        CONSTRAINT pk_library_moved PRIMARY KEY (entry_id, from_library_id, moved_at),
        CONSTRAINT fk_library_moved_library FOREIGN KEY (from_library_id) REFERENCES app.library (id)
    );
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_library_moved_from')
    CREATE INDEX ix_library_moved_from ON app.library_moved (from_library_id, moved_at);
GO

/*
    DIE UMSTELLUNG JE BIBLIOTHEK (area_rule_at). Bis 2026-10-22 sah ein
    Nichtmitglied nur, was einzeln veröffentlicht war — auch in einem
    öffentlichen Bereich. Liest jetzt jeder alle Hüllen eines öffentlichen
    Bereichs, würde sichtbar, was nie veröffentlicht war. Darum öffnet
    `/library/{id}/open` eine Bibliothek erst, wenn ihre Umstellung im
    Browser (dort sind die Schlüssel) durchgesehen und bestätigt ist; eine neue
    Bibliothek ist von Anfang an umgestellt. Keine zweite Sichtbarkeit: nur ein
    Übergang, der einmal geschieht.
*/
IF COL_LENGTH('app.library', 'area_rule_at') IS NULL
    ALTER TABLE app.library ADD area_rule_at datetimeoffset NULL;
GO
