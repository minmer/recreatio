/*
    PYTANIE ZDJĘTE Z FORMULARZA (0086) — die Antworten bleiben.

    Bisher verweigerte der Dienst, eine Frage zu löschen, auf die schon jemand
    geantwortet hatte („Usunięcie zostawiłoby odpowiedź bez pytania"). Richtig,
    was die Antworten angeht — falsch für den, der sein Formular weiterbaut:
    eine Frage, die nicht mehr gestellt werden soll, MUSS vom Formular
    verschwinden können.

    Jetzt verschwindet sie vom Formular (`removed_at`): niemand bekommt sie mehr
    zu sehen, niemand muss sie mehr beantworten — und die Kanzlei sieht ihre
    Antworten weiter in der Tabelle der Zgłoszenia, mit ihrer Beschriftung,
    und kann sie zurückholen („Przywróć"). Eine Frage ohne Antworten wird wie
    bisher wirklich gelöscht.

    Die WYMAGANIA eines Formulars (Niepełnoletni, Zdrowie, Ubezpieczenie,
    Zasady) stehen in seiner Einstellung (`config.needs`) mit den Kennungen
    ihrer Fragen; solange eine eingeschaltet ist, lässt sich keine davon
    entfernen — verschieben schon. Dafür braucht es keine Spalte.
*/

IF COL_LENGTH('app.slug_field', 'removed_at') IS NULL
    ALTER TABLE app.slug_field ADD removed_at datetimeoffset(7) NULL;
GO
