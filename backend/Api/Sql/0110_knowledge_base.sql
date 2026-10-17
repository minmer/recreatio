/*
    BAZA WIEDZY (0110) — Cogita neben der Bibliothek, nicht in ihr.

    Eine BIBLIOTHEK ist eine Sammlung von Büchern (0064): Werke, Zitate,
    Texte, Personen, Themen — für Predigten und Quellen. Eine BAZA WIEDZY ist,
    was Cogita lehrt: Arten, Wissen, Fragen, Vorlagen, Wiederholungen, Abläufe,
    Sitzungen, Fortschritt. Zwei Strukturen nebeneinander; beide liegen im
    selben versiegelten Speicher (ein Dokument je Eintrag, Fassungen, Dateien,
    Veröffentlichung, Abschriften) und unterscheiden sich hier: `kind`.

    Eine Baza wiedzy verweist auf Bibliotheken (nur als Quellen, auf die man
    zeigt) und auf andere Bazy wiedzy (zum Wiederverwenden), auch in anderen
    Bereichen. Die Verweise stehen versiegelt in ihren Einstellungen; gelesen
    wird jede mit dem Zugang zu ihrem eigenen Bereich — der Dienst kennt sie
    nicht und gibt durch sie nichts frei.
*/

IF COL_LENGTH('app.library', 'kind') IS NULL
    ALTER TABLE app.library ADD kind nvarchar(16) NOT NULL CONSTRAINT df_library_kind DEFAULT N'books';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_library_kind' AND parent_object_id = OBJECT_ID('app.library'))
    ALTER TABLE app.library ADD CONSTRAINT ck_library_kind CHECK (kind IN (N'books', N'knowledge'));
GO
