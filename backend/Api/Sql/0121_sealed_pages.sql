/*
    VERSIEGELTE SEITEN (0121, 2026-10-21).

    Eine Seite nur mit Zugang (0051) darf versiegelt werden. Dann liegen ihr
    Titel, ihr Vorspann, ihr Aussehen (mit den Szenen einer Präsentation), ihre
    Karte (0048), ihr „Wybór na stronie" (0082), die Anordnung und der Inhalt
    ihrer Bausteine und ihr Menü nur noch als Hülle in den bisherigen Spalten —
    eine Zeichenkette „rcs1.<Fassung>.<Hülle>", die der Browser öffnet.

    <b>Der Schlüssel der Seite</b> entsteht im Browser und wird verpackt: unter
    dem Epochenschlüssel jedes Bereichs, an den die Seite gebunden ist, und
    unter dem Schlüssel der Rolle, die sie führt. Die Hüllen stehen hier:

        page_seal   {"v": Fassung, "w": [{"a": Bereich, "e": Epoche, "k": Hülle},
                                         {"r": Rolle, "k": Hülle}]}
                    NULL: die Seite ist offen.

    <b>Was der Dienst weiter sieht</b>: die Adresse, dass es die Seite gibt, wie
    viele Bausteine welcher Art sie trägt, die Grössen und Zeiten, wer
    gespeichert hat. Die Einstellungen eines Formulars bleiben lesbar — der
    Dienst setzt mit ihnen Regeln durch (Portal, gesperrte Fragen); seine
    Fragen und Antworten sind ohnehin versiegelt.

    Breiter wird, was versiegelt länger ist als offen: der Titel (200 → 2000),
    der Vorspann (4000 → max), der Wybór (2000 → max). Die Grenzen für den
    offenen Text prüft weiter der Dienst.

    Es wird nichts gelöscht und nichts umgeschrieben: jede Seite bleibt offen,
    bis jemand sie versiegelt.
*/

IF COL_LENGTH('app.slug', 'page_seal') IS NULL
    ALTER TABLE app.slug ADD page_seal nvarchar(max) NULL;
GO

/* Der Titel: die Prüfung hängt an der Spalte und muss für das Verbreitern kurz weichen. */
IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug_page') AND name = 'title' AND max_length BETWEEN 1 AND 3999)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_title')
        ALTER TABLE app.slug_page DROP CONSTRAINT ck_slug_page_title;

    ALTER TABLE app.slug_page ALTER COLUMN title nvarchar(2000) NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'ck_slug_page_title')
    ALTER TABLE app.slug_page ADD CONSTRAINT ck_slug_page_title CHECK (LEN(title) > 0);
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug_page') AND name = 'lead' AND max_length <> -1)
    ALTER TABLE app.slug_page ALTER COLUMN lead nvarchar(max) NULL;
GO

IF EXISTS (SELECT 1 FROM sys.columns
           WHERE object_id = OBJECT_ID('app.slug') AND name = 'page_subject' AND max_length <> -1)
    ALTER TABLE app.slug ALTER COLUMN page_subject nvarchar(max) NULL;
GO
