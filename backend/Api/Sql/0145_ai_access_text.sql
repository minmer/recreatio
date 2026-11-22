/*
    0145 — DIE VOLLSTÄNDIGEN TEXTE EINER ABSCHRIFT ALS EIGENE STÜCKE (2026-11-22).

        Bisher trug die Abschrift eines Behälters (`app.ai_access_part.snapshot`, gzip-JSON unter C) alle vollständigen Texte
        mit; war sie zu gross, fielen ALLE Texte des Behälters weg. Ab Format 2 trägt sie nur noch das Verzeichnis der Texte
        (Werk, Regel der Stellen, Teile, Grössen, Stand) und je Teil die Adressen seiner Stücke. Ein Stück ist eine Folge von
        Blöcken eines Teils, inhaltlich adressiert (SHA-256 des JSON), gzip, versiegelt unter demselben Schlüssel C des Zugangs
        (AAD `ai:text:<behälter>:ai_text:1`; der Dienst prüft nach dem Öffnen den Hash). Ein Text, der wächst, nimmt den
        anderen nichts weg; ein Neubau lädt nur Stücke, deren Hash neu ist.

        Je Zugang und Behälter — wie die Abschrift selbst (jeder Zugang hat seinen eigenen Schlüssel). Fällt der Behälter aus
        dem Zugang oder der Zugang weg, gehen seine Stücke mit. Noch einmal ausgeführt, ändert es nichts.
*/

IF OBJECT_ID(N'app.ai_access_text', N'U') IS NULL
BEGIN
    CREATE TABLE app.ai_access_text
    (
        access_id   uniqueidentifier  NOT NULL,
        library_id  uniqueidentifier  NOT NULL,
        hash        char(64)          NOT NULL,
        blob        varbinary(max)    NOT NULL,
        size        int               NOT NULL,
        made_at     datetimeoffset    NOT NULL CONSTRAINT df_ai_access_text_made DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT pk_ai_access_text PRIMARY KEY (access_id, library_id, hash),
        CONSTRAINT fk_ai_access_text_part FOREIGN KEY (access_id, library_id) REFERENCES app.ai_access_part (access_id, library_id) ON DELETE CASCADE
    );
END
GO
