/*
    0123 — BAZY WIEDZY FOLGEN DER REGEL DES BEREICHS (Schritt 8, 2026-10-22).

    Bis hierher las niemand ohne Konto eine Baza wiedzy: `/library/{id}/open`
    nahm nur Bibliotheken (books), und öffentlich war nur, was einzeln
    veröffentlicht war (eine offene Fassung neben der Hülle). Jetzt öffnet
    `/open` auch eine Baza wiedzy — als GANZE, mit Fragen, Antworten und
    Entwürfen —, wenn ihr Bereich öffentlich ist UND ihre Umstellung bestätigt
    ist (area_rule_at, 0122).

    Eine Baza, die seit 0122 angelegt wurde, trägt area_rule_at schon von der
    Anlage — ohne dass jemand gelesen hätte, dass sie damit in einem
    öffentlichen Bereich ganz öffentlich wird. Damit niemand etwas liest, das
    er vorher nicht lesen konnte, beginnt jede bestehende Baza wieder als
    „nicht bestätigt"; wer in ihr schreibt, öffnet sie in ihren Einstellungen
    (Widoczność), nachdem er gelesen hat, was das heisst. Für Bazy hatte
    area_rule_at bis hierher keine Wirkung: es geht nichts verloren.

    Bibliotheken (books) bleiben, wie sie sind. Der Migrationslauf wendet das
    einmal an; noch einmal von Hand ausgeführt, schliesst es nur wieder — es
    öffnet nie etwas. Keine Daten eines Benutzers werden verändert.
*/

IF COL_LENGTH('app.library', 'area_rule_at') IS NOT NULL
    EXEC (N'UPDATE app.library SET area_rule_at = NULL WHERE kind = N''knowledge'' AND area_rule_at IS NOT NULL;');
GO
