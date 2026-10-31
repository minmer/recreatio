/*
    0136 — ANTWORTEN IM EIGENEN BEREICH EINER PERSON (2026-11-01).

    Ein Stapel des Lernens kann für den Epochenschlüssel seines Bereichs versiegelt sein
    statt für dessen Przyjęcia. Dann öffnet ihn jeder, der den Bereich liest — beim
    Kleinbereich eines Formulars (0120): die Person selbst und die Rollen, die die Regel
    des virtuellen Bereichs nennt (etwa die Prowadzący). Die Lesbarkeit des Bereichs ist
    der Zugang; eine eigene Przyjęcia braucht es dafür nicht.

      learn_batch.area_epoch   die Epoche jenes Schlüssels; NULL: für die Przyjęcia (wie bisher)

    Noch einmal ausgeführt, ändert es nichts.
*/

IF COL_LENGTH('app.learn_batch', 'area_epoch') IS NULL
    ALTER TABLE app.learn_batch ADD area_epoch int NULL;
GO
