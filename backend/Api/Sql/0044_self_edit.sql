/*
    Darf der Mensch seine Antwort spaeter selbst berichtigen?

    =========================================================================
    WARUM AN DER FRAGE
    =========================================================================

    Bisher stand das an dem Baustein, der die Einsendung im Portal zeigt
    („Czy można poprawiać: tak / nie") — und dort galt es nur fuer den Knopf.
    Der Dienst nahm jede Berichtigung an, gleich was die Seite zeigte: ein
    „nie" war eine Bitte an den Browser, keine Regel.

    Ob jemand sein Geburtsdatum nach dem Absenden aendern darf, ist aber eine
    Eigenschaft der FRAGE und nicht der Seite, auf der die Antwort erscheint:
    dieselbe Antwort kann auf zwei Portalen stehen, und sie darf nicht auf dem
    einen fest und auf dem anderen offen sein. Also steht es hier, und der
    Dienst prueft es bei jeder Berichtigung (Seat.ReviseAsync).

    Vorgabe JA — so, wie es bisher tatsaechlich war. Die Kanzlei selbst
    berichtigt weiter alles (reviseAsOffice); das hier betrifft nur den Weg
    ueber den Link.
*/

IF COL_LENGTH('app.slug_field', 'self_edit') IS NULL
BEGIN
    ALTER TABLE app.slug_field
        ADD self_edit bit NOT NULL
            CONSTRAINT df_slug_field_self_edit DEFAULT 1;
END
GO
