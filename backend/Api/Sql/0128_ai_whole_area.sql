/*
    0128 — EIN LINK FÜR AI KANN SEINEM BEREICH FOLGEN (2026-10-24).

    Bisher zeigte ein Dostęp-dla-AI-Link (0126) genau die Behälter, die beim
    Anlegen angehakt waren. Kam später ein Behälter in den Bereich (eine
    Bibliothek, ein Skryptorium, eine Baza wiedzy), sah ihn der Assistent nicht —
    auch nicht über MCP (0127).

    whole_area   1: der Link zeigt ALLE Behälter seines Bereichs, auch die, die
                 später dazukommen (der Dienst nimmt sie beim Anlegen eines
                 Behälters, beim Auflisten und beim Lesen dazu; die Abschrift baut
                 der nächste Browser, der dort schreibt). 0: nur die gewählten.

    Bestehende Links: wer beim Anlegen JEDEN Behälter angehakt hatte, den der
    Bereich damals hatte, meinte den ganzen Bereich — diese Links folgen ihm von
    nun an. Wer etwas ausgelassen hatte, behält seine Auswahl. Umstellen kann
    jeder, der den Bereich prowadzi (Dostęp → Dostęp dla AI → Zbiory).

    Noch einmal ausgeführt, ändert es nichts (die Zuordnung der bestehenden Links
    geschieht nur, wenn die Spalte neu angelegt wird).
*/

IF COL_LENGTH('app.ai_access', 'whole_area') IS NULL
BEGIN
    ALTER TABLE app.ai_access ADD whole_area bit NOT NULL CONSTRAINT df_ai_access_whole_area DEFAULT (0);
    EXEC (N'
        UPDATE a SET whole_area = 1
        FROM app.ai_access a
        WHERE EXISTS (SELECT 1 FROM app.ai_access_part p WHERE p.access_id = a.id)
          AND NOT EXISTS (
              SELECT 1 FROM app.library l
              WHERE l.area_id = a.area_id
                AND l.kind IN (N''books'', N''writing'', N''knowledge'')
                AND l.created_at <= a.created_at
                AND NOT EXISTS (SELECT 1 FROM app.ai_access_part p WHERE p.access_id = a.id AND p.library_id = l.id));
    ');
END
GO
