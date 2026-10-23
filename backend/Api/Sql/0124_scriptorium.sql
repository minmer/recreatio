/*
    0124 — DAS SKRYPTORIUM (2026-10-23, drei Teile: Bibliothek, Nauka, Skryptorium).

    Ein dritter Behälter im selben versiegelten Speicher: `app.library` mit
    kind = 'writing'. Er hält die eigenen Texte, ihre Wygłoszenia, Projekte
    und die Rodzaje tekstów des Besitzers — wie eine Bibliothek: versiegelt
    im Browser, wer liest, entscheidet allein der Bereich. Je Bereich höchstens
    eines (der Dienst prüft es beim Anlegen, wie bei der Bibliothek).

    Nur die Prüfregel der Art wird weiter. Keine Daten eines Benutzers werden
    verändert; noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_library_kind' AND parent_object_id = OBJECT_ID('app.library'))
    ALTER TABLE app.library DROP CONSTRAINT ck_library_kind;
GO

ALTER TABLE app.library ADD CONSTRAINT ck_library_kind CHECK (kind IN (N'books', N'knowledge', N'writing'));
GO
