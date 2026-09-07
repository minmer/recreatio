/*
    Der Untertitel der Veranstaltung — und warum er nicht der Anriss ist.

    Das alte Modul hat beide, und das ist kein Versehen:

        subtitle   das Motto AUF der Seite, unter dem Titel
                   („Pielgrzymka rowerowa z Krakowa do Częstochowy")

        summary    der Anriss auf der KATALOGKARTE, wo wenig Platz ist
                   und ein anderer Ton passt

    Sie zu einem Feld zusammenzuziehen hiesse: entweder steht auf der Karte ein
    Motto, das dort zu lang ist, oder auf der Seite ein Karteitext, der dort zu
    duerr klingt. rc hatte bisher nur `summary` — der Untertitel fehlte, und die
    Seite begann darum gleich nach dem Titel mit dem ersten Abschnitt.
*/

IF COL_LENGTH('dbo.rc_event', 'subtitle') IS NULL
BEGIN
    ALTER TABLE dbo.rc_event ADD subtitle nvarchar(300) NULL;
END
GO
