/*
    WORUM ES AUF EINER SEITE GEHT (0082) — „Wybór na stronie".

    Eine Seite kann sagen, wovon sie handelt: etwa „von EINEM Menschen aus dem
    Formular Zapisy". Dann wählt man oben auf der Seite, um wen es geht (keiner
    da — die Bausteine dazu schweigen; einer — er ist gewählt; mehrere — eine
    Auswahl mit ◀ ▶), und jeder Baustein der Seite nimmt diese Wahl: die
    Antworten, die Schritte, die Rozmowa mit ihm, sein Link.

    Gespeichert wird nur, WOVON die Seite handelt (JSON, im Browser gelesen),
    an der ADRESSE wie Aussehen und Karte — ein Alias zeigt, was sein Ziel
    zeigt. Wer gewählt ist, steht in der Adresse (`?wpis=…`), nicht hier.
*/

IF COL_LENGTH('app.slug', 'page_subject') IS NULL
    ALTER TABLE app.slug ADD page_subject nvarchar(2000) NULL;
GO
