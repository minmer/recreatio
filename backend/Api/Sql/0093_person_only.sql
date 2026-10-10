/*
    ODPOWIADA TYLKO OSOBA (0093) — eine Frage, deren Antwort allein der Mensch
    schreibt und berichtigt.

    Bisher konnte die Kanzlei jede Antwort berichtigen (`ReviseAsOfficeAsync`,
    die Tabelle der Zgłoszenia, das Ordnen von Nummern und Adressen) und für
    einen Menschen eintragen (`EntryAsync`). Für Daten ist das richtig — für
    die eigenen Ziele eines Kandidaten („moje cele na najbliższe miesiące")
    nicht: das sind seine Worte, und kein Koordinator soll sie ändern können.

    `person_only`: die Kanzlei liest die Antwort wie jede andere, schreibt sie
    aber nie — weder berichtigen noch an seiner Stelle eintragen. Der Mensch
    berichtigt sie über seinen Link; deshalb gilt mit ihr immer auch
    `self_edit`.
*/

IF COL_LENGTH('app.slug_field', 'person_only') IS NULL
    ALTER TABLE app.slug_field ADD person_only bit NOT NULL
        CONSTRAINT df_slug_field_person_only DEFAULT 0;
GO
