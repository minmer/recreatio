/*
    0140 — EIN DURCHGANG DER WELTKARTE (documentation/world-map): ein Stapel des Lernens kann jetzt auch die Art `run`
    haben — ein Testdurchgang über alle Karten eines Ortes (welcher Ort, wer, wann, wie viele Karten, richtig beim
    ersten Mal, richtig nach einer Korrektur, Versuche). Versiegelt wie jeder Stapel, nur für den Halter (ohne
    Schlüssel des Bereichs); der Dienst sieht davon nur die Art.

    Ein Durchgang wird nie ersetzt (nicht „nur der jüngste") — die Stufe rechnet der Browser aus allen Durchgängen.

    Noch einmal ausgeführt, ändert es nichts.
*/

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = N'ck_learn_batch_kind' AND parent_object_id = OBJECT_ID('app.learn_batch')
             AND definition NOT LIKE N'%''run''%')
BEGIN
    ALTER TABLE app.learn_batch DROP CONSTRAINT ck_learn_batch_kind;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
               WHERE name = N'ck_learn_batch_kind' AND parent_object_id = OBJECT_ID('app.learn_batch'))
BEGIN
    ALTER TABLE app.learn_batch ADD CONSTRAINT ck_learn_batch_kind
        CHECK (kind IN (N'answers', N'snapshots', N'position', N'values', N'suspend', N'flags', N'counts', N'run'));
END
GO
